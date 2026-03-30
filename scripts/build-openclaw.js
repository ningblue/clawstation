const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Helper for logging
const log = (msg) => console.log(`[Build] ${msg}`);
const error = (msg) => console.error(`[Build Error] ${msg}`);

// Paths
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SIBLING_OPENCLAW = path.join(path.dirname(PROJECT_ROOT), "openclaw");
const OPENCLAW_SRC = fs.existsSync(SIBLING_OPENCLAW)
  ? SIBLING_OPENCLAW
  : path.join(PROJECT_ROOT, "lib", "openclaw");
const RESOURCES_DIR = path.join(PROJECT_ROOT, "resources", "openclaw");

// Supported architectures
const ARCHITECTURES = ["arm64", "x64"];

// Ensure directories exist
if (!fs.existsSync(OPENCLAW_SRC)) {
  error(`OpenClaw source not found at ${OPENCLAW_SRC}`);
  process.exit(1);
}

// 1. Determine Package Manager and build source
let pkgManager = "npm";
// 在 Windows 上强制使用 npm，避免 pnpm 的权限问题
if (process.platform !== 'win32') {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    pkgManager = "pnpm";
  } catch (e) {
    log("pnpm not found, falling back to npm");
  }
} else {
  log("Windows platform detected, using npm to avoid pnpm permission issues");
}

// 2. Check if OpenClaw source exists and is valid
if (!fs.existsSync(OPENCLAW_SRC)) {
  error(`OpenClaw source not found at ${OPENCLAW_SRC}`);
  error(`Expected OpenClaw to be cloned by GitHub Actions cache or manually`);
  process.exit(1);
}

// Check if package.json exists (basic validation)
const openclawPackageJson = path.join(OPENCLAW_SRC, "package.json");
if (!fs.existsSync(openclawPackageJson)) {
  error(`OpenClaw package.json not found at ${openclawPackageJson}`);
  error(`The OpenClaw repository may not have been cloned properly`);
  process.exit(1);
}

// 3. Build OpenClaw source (architecture-independent)
log(`Building OpenClaw source from ${OPENCLAW_SRC} using ${pkgManager}...`);
try {
  let installCmd;
  if (pkgManager === "pnpm" && process.env.CI) {
    installCmd = `${pkgManager} install --no-frozen-lockfile`;
  } else if (pkgManager === "npm") {
    // npm 在 Windows 上需要特殊标志处理依赖冲突
    installCmd = `npm install --legacy-peer-deps`;
  } else {
    installCmd = `${pkgManager} install`;
  }
  
  log(`Running: ${installCmd}`);
  execSync(installCmd, { cwd: OPENCLAW_SRC, stdio: "inherit" });
  
  log(`Running: ${pkgManager} run build`);
  execSync(`${pkgManager} run build`, { cwd: OPENCLAW_SRC, stdio: "inherit" });
  
  log(`Building OpenClaw UI...`);
  execSync(`${pkgManager} run ui:build`, {
    cwd: OPENCLAW_SRC,
    stdio: "inherit",
  });
} catch (e) {
  error(`Failed to build OpenClaw: ${e.message}`);
  error(`Working directory: ${OPENCLAW_SRC}`);
  error(`Package manager: ${pkgManager}`);
  process.exit(1);
}

// 3. Prepare Resources Directory
log(`Preparing resources directory at ${RESOURCES_DIR}...`);
if (fs.existsSync(RESOURCES_DIR)) {
  fs.rmSync(RESOURCES_DIR, { recursive: true, force: true });
}
fs.mkdirSync(RESOURCES_DIR, { recursive: true });

// 4. Build for each architecture
for (const arch of ARCHITECTURES) {
  buildForArch(arch);
}

log("OpenClaw build complete for all architectures!");

/**
 * Build OpenClaw for a specific architecture
 * @param {string} arch - Target architecture (arm64 or x64)
 */
function buildForArch(arch) {
  log(`Building OpenClaw for ${arch}...`);

  const archDir = path.join(RESOURCES_DIR, arch);

  // Clean and create directory
  if (fs.existsSync(archDir)) {
    fs.rmSync(archDir, { recursive: true, force: true });
  }
  fs.mkdirSync(archDir, { recursive: true });

  // Copy built artifacts from source (dist is architecture-independent)
  const copyRecursive = (src, dest) => {
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      log(`Warning: Source ${src} does not exist, skipping.`);
    }
  };

  copyRecursive(
    path.join(OPENCLAW_SRC, "dist"),
    path.join(archDir, "dist"),
  );
  copyRecursive(
    path.join(OPENCLAW_SRC, "docs"),
    path.join(archDir, "docs"),
  );
  fs.copyFileSync(
    path.join(OPENCLAW_SRC, "package.json"),
    path.join(archDir, "package.json"),
  );
  fs.copyFileSync(
    path.join(OPENCLAW_SRC, "openclaw.mjs"),
    path.join(archDir, "openclaw.mjs"),
  );

  // Copy templates
  const templatesDir = path.join(archDir, "docs", "reference", "templates");
  const sourceTemplatesDir = path.join(OPENCLAW_SRC, "docs", "reference", "templates");
  if (fs.existsSync(sourceTemplatesDir)) {
    const standardTemplates = ["IDENTITY.md", "USER.md"];
    for (const template of standardTemplates) {
      const srcPath = path.join(sourceTemplatesDir, template);
      const destPath = path.join(templatesDir, template);
      if (fs.existsSync(srcPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        log(`Copied template: ${template}`);
      }
    }
  }

  // Patch package.json for libsignal-node
  try {
    const pkgJsonPath = path.join(archDir, "package.json");
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

    if (!pkgJson.overrides) pkgJson.overrides = {};
    pkgJson.overrides["libsignal-node"] =
      "git+https://github.com/whiskeysockets/libsignal-node.git";

    if (!pkgJson.resolutions) pkgJson.resolutions = {};
    pkgJson.resolutions["libsignal-node"] =
      "git+https://github.com/whiskeysockets/libsignal-node.git";

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  } catch (e) {
    error("Failed to patch package.json: " + e.message);
  }

  // Install dependencies for specific architecture
  log(`Installing dependencies for ${arch}...`);
  const env = {
    ...process.env,
    npm_config_arch: arch,
    npm_config_target_arch: arch,
    npm_config_disturl: "https://nodejs.org/dist",
    // 注意：不设置 build_from_source，让大多数包使用预编译二进制文件
    // 只有缺少预编译版本的包才会尝试从源码编译
  };

  try {
    execSync("npm install --production --legacy-peer-deps", {
      cwd: archDir,
      stdio: "inherit",
      env,
    });

    // Ensure chalk is installed
    const chalkPath = path.join(archDir, "node_modules", "chalk");
    if (!fs.existsSync(chalkPath)) {
      execSync("npm install chalk@5.3.0 --no-save --legacy-peer-deps", {
        cwd: archDir,
        stdio: "inherit",
        env,
      });
    }
  } catch (e) {
    log(`Warning: Failed to install dependencies for ${arch}: ${e.message}`);
  }

  // Create wrapper.js
  const wrapperContent = `console.log("WRAPPER ENV:", process.env.OPENCLAW_PROCESS_NAME);
process.title = process.env.OPENCLAW_PROCESS_NAME || 'clawstation-engine';
try {
  await import('./dist/entry.js');
} catch (err) {
  console.error('Failed to launch OpenClaw:', err);
  process.exit(1);
}
`;
  fs.writeFileSync(path.join(archDir, "wrapper.js"), wrapperContent);

  // Patch entry.js
  const distDir = path.join(archDir, "dist");
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    files.forEach((file) => {
      const filePath = path.join(distDir, file);
      if (!file.endsWith(".js")) return;

      let content = fs.readFileSync(filePath, "utf8");
      let changed = false;

      // Patch process.title
      if (content.includes('process.title = "openclaw"')) {
        content = content.replace(
          /(process[\w$]*)\.title\s*=\s*"openclaw"/g,
          '$1.title = $1.env.OPENCLAW_PROCESS_NAME || "openclaw"'
        );
        changed = true;
      }

      // Patch entry.js isMainModule check
      if (file === "entry.js" && content.includes("if (!isMainModule(")) {
        content = content.replace(
          /if \(!isMainModule\(\{/g,
          "if (false && !isMainModule({"
        );
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content);
        log(`Patched ${file}`);
      }
    });
  }

  log(`Build complete for ${arch}`);
  return archDir;
}
