#!/bin/bash
set -e

# Directory setup
PROJECT_ROOT=$(pwd)
OPENCLAW_SRC="$PROJECT_ROOT/lib/openclaw"
RESOURCES_DIR="$PROJECT_ROOT/resources/openclaw"

echo "Building OpenClaw from $OPENCLAW_SRC..."

# Check if pnpm is available, otherwise try to use corepack or npm
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
else
    echo "pnpm not found, trying corepack..."
    if command -v corepack &> /dev/null; then
        corepack enable
        if command -v pnpm &> /dev/null; then
             PKG_MANAGER="pnpm"
        else
             echo "pnpm still not found via corepack. Falling back to npm."
             PKG_MANAGER="npm"
        fi
    else
        echo "corepack not found. Falling back to npm."
        PKG_MANAGER="npm"
    fi
fi

cd "$OPENCLAW_SRC"

echo "Installing dependencies using $PKG_MANAGER..."
$PKG_MANAGER install

echo "Building OpenClaw..."
$PKG_MANAGER run build

echo "Preparing resources directory..."
rm -rf "$RESOURCES_DIR"
mkdir -p "$RESOURCES_DIR"

echo "Copying artifacts..."
cp -r dist "$RESOURCES_DIR/"
cp -r docs "$RESOURCES_DIR/" 2>/dev/null || echo "No docs directory to copy"
cp package.json "$RESOURCES_DIR/"
cp openclaw.mjs "$RESOURCES_DIR/"

echo "Installing production dependencies in resources..."
cd "$RESOURCES_DIR"
npm install --production --legacy-peer-deps

echo "Creating wrapper for process name..."
cat > wrapper.js <<EOF
// Wrapper to set process title and launch OpenClaw
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

// Forward to the actual entry point
try {
  await import('./dist/entry.js');
} catch (err) {
  console.error('Failed to launch OpenClaw:', err);
  process.exit(1);
}
EOF

# Patch OpenClaw to respect OPENCLAW_PROCESS_NAME
echo "Patching OpenClaw to respect OPENCLAW_PROCESS_NAME..."
# Patch entry.js: process$1.title = "openclaw" -> process$1.title = process$1.env.OPENCLAW_PROCESS_NAME || "openclaw"
find "$RESOURCES_DIR/dist" -name "*.js" -print0 | xargs -0 perl -i -pe 's/(process[\w\$]*)\.title\s*=\s*"openclaw"/$1.title = $1.env.OPENCLAW_PROCESS_NAME || "openclaw"/g'

# Patch program*.js: process.title = `${cliName}-${name}` -> process.title = process.env.OPENCLAW_PROCESS_NAME || `${cliName}-${name}`
find "$RESOURCES_DIR/dist" -name "*.js" -print0 | xargs -0 perl -i -pe 's/process\.title\s*=\s*`\$\{cliName\}-\$\{name\}`/process.title = process.env.OPENCLAW_PROCESS_NAME || `\${cliName}-\${name}`/g'

# Patch entry.js to force execution even when imported (via wrapper)
# if (!isMainModule({ ... })) {} else { ... } -> if (false && !isMainModule({ ... })) {} else { ... }
find "$RESOURCES_DIR/dist" -name "entry.js" -print0 | xargs -0 perl -i -pe 's/if \(!isMainModule\(\{/if (false && !isMainModule({/g'

echo "OpenClaw build complete in $RESOURCES_DIR"
