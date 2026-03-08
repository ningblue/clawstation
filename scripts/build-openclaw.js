const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

// Helper for logging
const log = (msg) => console.log(`[Build] ${msg}`);
const error = (msg) => console.error(`[Build Error] ${msg}`);

// Paths
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OPENCLAW_SRC = path.join(PROJECT_ROOT, "lib", "openclaw");
const RESOURCES_DIR = path.join(PROJECT_ROOT, "resources", "openclaw");

// Ensure directories exist
if (!fs.existsSync(OPENCLAW_SRC)) {
  error(`OpenClaw source not found at ${OPENCLAW_SRC}`);
  process.exit(1);
}

// 1. Determine Package Manager
let pkgManager = "npm";
try {
  execSync("pnpm --version", { stdio: "ignore" });
  pkgManager = "pnpm";
} catch (e) {
  log("pnpm not found, falling back to npm");
}

// 2. Build OpenClaw
log(`Building OpenClaw from ${OPENCLAW_SRC} using ${pkgManager}...`);
try {
  execSync(`${pkgManager} install`, { cwd: OPENCLAW_SRC, stdio: "inherit" });
  execSync(`${pkgManager} run build`, { cwd: OPENCLAW_SRC, stdio: "inherit" });
} catch (e) {
  error("Failed to build OpenClaw");
  process.exit(1);
}

// 3. Prepare Resources Directory
log(`Preparing resources directory at ${RESOURCES_DIR}...`);
if (fs.existsSync(RESOURCES_DIR)) {
  fs.rmSync(RESOURCES_DIR, { recursive: true, force: true });
}
fs.mkdirSync(RESOURCES_DIR, { recursive: true });

// 4. Copy Artifacts
log("Copying artifacts...");
const copyRecursive = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    log(`Warning: Source ${src} does not exist, skipping.`);
  }
};

copyRecursive(
  path.join(OPENCLAW_SRC, "dist"),
  path.join(RESOURCES_DIR, "dist")
);
copyRecursive(
  path.join(OPENCLAW_SRC, "docs"),
  path.join(RESOURCES_DIR, "docs")
);
fs.copyFileSync(
  path.join(OPENCLAW_SRC, "package.json"),
  path.join(RESOURCES_DIR, "package.json")
);
fs.copyFileSync(
  path.join(OPENCLAW_SRC, "openclaw.mjs"),
  path.join(RESOURCES_DIR, "openclaw.mjs")
);

// Copy standard templates from node_modules (if not present in docs)
const templatesDir = path.join(RESOURCES_DIR, "docs", "reference", "templates");

// Find openclaw templates in pnpm virtual store
const openclawNodeModulesPath = path.join(
  OPENCLAW_SRC,
  "node_modules",
  ".pnpm"
);
let nodeModulesTemplatesDir = null;

if (fs.existsSync(openclawNodeModulesPath)) {
  const entries = fs.readdirSync(openclawNodeModulesPath);
  for (const entry of entries) {
    if (entry.startsWith("openclaw@")) {
      const possiblePath = path.join(
        openclawNodeModulesPath,
        entry,
        "node_modules",
        "openclaw",
        "docs",
        "reference",
        "templates"
      );
      if (fs.existsSync(possiblePath)) {
        nodeModulesTemplatesDir = possiblePath;
        break;
      }
    }
  }
}

// Fallback to standard node_modules path
if (!nodeModulesTemplatesDir) {
  nodeModulesTemplatesDir = path.join(
    OPENCLAW_SRC,
    "node_modules",
    "openclaw",
    "docs",
    "reference",
    "templates"
  );
}

if (nodeModulesTemplatesDir && fs.existsSync(nodeModulesTemplatesDir)) {
  log(`Found templates in: ${nodeModulesTemplatesDir}`);
  const standardTemplates = ["IDENTITY.md", "USER.md"];
  for (const template of standardTemplates) {
    const srcPath = path.join(nodeModulesTemplatesDir, template);
    const destPath = path.join(templatesDir, template);
    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      log(`Copied standard template: ${template}`);
    }
  }
} else {
  log("Warning: Could not find openclaw templates in node_modules");
}

// 5. Install Production Dependencies
log("Installing production dependencies in resources...");
try {
  execSync("npm install --production --legacy-peer-deps", {
    cwd: RESOURCES_DIR,
    stdio: "inherit",
  });
} catch (e) {
  error("Failed to install production dependencies");
  process.exit(1);
}

// 6. Create Wrapper
log("Creating wrapper.js...");
const wrapperContent = `console.log("WRAPPER ENV:", process.env.OPENCLAW_PROCESS_NAME);
// Wrapper to set process title and launch OpenClaw
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';

// Forward to the actual entry point
try {
  await import('./dist/entry.js');
} catch (err) {
  console.error('Failed to launch OpenClaw:', err);
  process.exit(1);
}
`;
fs.writeFileSync(path.join(RESOURCES_DIR, "wrapper.js"), wrapperContent);

// 7. Patch OpenClaw Files
log("Patching OpenClaw files...");

const patchFile = (filePath, searchRegex, replaceStr) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");
  const newContent = content.replace(searchRegex, replaceStr);
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    log(`Patched ${path.basename(filePath)}`);
  }
};

const distDir = path.join(RESOURCES_DIR, "dist");
const files = fs.readdirSync(distDir);

files.forEach((file) => {
  const filePath = path.join(distDir, file);
  if (!file.endsWith(".js")) return;

  // Patch entry.js: process.title = "openclaw" -> process.title = process.env.OPENCLAW_PROCESS_NAME || "openclaw"
  // Regex: /(process[\w$]*)\.title\s*=\s*"openclaw"/g
  // Replacement: '$1.title = $1.env.OPENCLAW_PROCESS_NAME || "openclaw"'
  patchFile(
    filePath,
    /(process[\w$]*)\.title\s*=\s*"openclaw"/g,
    '$1.title = $1.env.OPENCLAW_PROCESS_NAME || "openclaw"'
  );

  // Patch program*.js: process.title = `${cliName}-${name}`
  // Regex: /process\.title\s*=\s*`\$\{cliName\}-\$\{name\}`/g
  // Replacement: 'process.title = process.env.OPENCLAW_PROCESS_NAME || `\${cliName}-\${name}`'
  patchFile(
    filePath,
    /process\.title\s*=\s*`\$\{cliName\}-\$\{name\}`/g,
    "process.title = process.env.OPENCLAW_PROCESS_NAME || `${cliName}-${name}`"
  );

  // Patch entry.js to force execution even when imported (via wrapper)
  // Regex: /if \(!isMainModule\(\{/g
  // Replacement: 'if (false && !isMainModule({'
  if (file === "entry.js") {
    patchFile(
      filePath,
      /if \(!isMainModule\(\{/g,
      "if (false && !isMainModule({"
    );
  }
});

log("OpenClaw build complete!");
