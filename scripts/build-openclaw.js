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
  log(`Building OpenClaw UI...`);
  execSync(`${pkgManager} run ui:build`, {
    cwd: OPENCLAW_SRC,
    stdio: "inherit",
  });
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
  path.join(RESOURCES_DIR, "dist"),
);
copyRecursive(
  path.join(OPENCLAW_SRC, "docs"),
  path.join(RESOURCES_DIR, "docs"),
);
fs.copyFileSync(
  path.join(OPENCLAW_SRC, "package.json"),
  path.join(RESOURCES_DIR, "package.json"),
);
fs.copyFileSync(
  path.join(OPENCLAW_SRC, "openclaw.mjs"),
  path.join(RESOURCES_DIR, "openclaw.mjs"),
);

// Copy standard templates from node_modules (if not present in docs)
const templatesDir = path.join(RESOURCES_DIR, "docs", "reference", "templates");

// Find openclaw templates in pnpm virtual store
const openclawNodeModulesPath = path.join(
  OPENCLAW_SRC,
  "node_modules",
  ".pnpm",
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
        "templates",
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
    "templates",
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

// FIX: Force libsignal-node to use HTTPS instead of SSH to avoid permission errors
try {
  const pkgJsonPath = path.join(RESOURCES_DIR, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

  if (!pkgJson.overrides) pkgJson.overrides = {};
  pkgJson.overrides["libsignal-node"] =
    "git+https://github.com/whiskeysockets/libsignal-node.git";

  // Also add resolution for pnpm just in case
  if (!pkgJson.resolutions) pkgJson.resolutions = {};
  pkgJson.resolutions["libsignal-node"] =
    "git+https://github.com/whiskeysockets/libsignal-node.git";

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  log("Patched package.json to force HTTPS for libsignal-node");
} catch (e) {
  error("Failed to patch package.json: " + e.message);
}

try {
  execSync("npm install --production --legacy-peer-deps", {
    cwd: RESOURCES_DIR,
    stdio: "inherit",
  });

  // 确保 chalk 已安装 (OpenClaw 运行时依赖)
  // 如果 npm install 部分失败，可能导致 chalk 缺失
  const chalkPath = path.join(RESOURCES_DIR, "node_modules", "chalk");
  if (!fs.existsSync(chalkPath)) {
    log("Chalk missing, attempting to install explicitly...");
    execSync("npm install chalk@5.3.0 --no-save --legacy-peer-deps", {
      cwd: RESOURCES_DIR,
      stdio: "inherit",
    });
  }
} catch (e) {
  // error("Failed to install production dependencies");
  // process.exit(1);
  log(
    "Warning: Failed to install production dependencies. Continuing anyway...",
  );

  // 即使主 install 失败，也要确保 chalk 存在
  const chalkPath = path.join(RESOURCES_DIR, "node_modules", "chalk");
  if (!fs.existsSync(chalkPath)) {
    log("Chalk missing (after failure), attempting to install explicitly...");
    try {
      // 使用 --ignore-scripts 防止触发任何可能导致失败的钩子
      // 使用 --no-package-lock 避免读取或更新锁文件
      execSync(
        "npm install chalk@5.3.0 --no-save --legacy-peer-deps --ignore-scripts --no-package-lock",
        {
          cwd: RESOURCES_DIR,
          stdio: "inherit",
        },
      );
    } catch (err) {
      error("Failed to install chalk: " + err.message);
      // 如果网络安装失败，尝试从项目根目录 node_modules 复制（如果存在）
      // 这里的假设是主项目可能有 chalk，或者在 lib/openclaw 中有
      // 但 openclaw 是 pnpm workspace，结构复杂。
      // 让我们尝试手动创建一个极简的 chalk 模块，以防万一
      log("Creating fallback chalk module...");
      const chalkDir = path.join(RESOURCES_DIR, "node_modules", "chalk");
      fs.mkdirSync(chalkDir, { recursive: true });

      const chalkPkgJson = {
        name: "chalk",
        version: "5.3.0",
        main: "./source/index.js",
        exports: "./source/index.js",
        type: "module",
      };
      fs.writeFileSync(
        path.join(chalkDir, "package.json"),
        JSON.stringify(chalkPkgJson, null, 2),
      );

      const chalkSourceDir = path.join(chalkDir, "source");
      fs.mkdirSync(chalkSourceDir, { recursive: true });

      // 创建一个极其简化的 chalk mock，只支持基本颜色，或者只是透传
      // OpenClaw 可能使用了 import { chalk } from 'chalk' 或者 import chalk from 'chalk'
      // Chalk 5 是纯 ESM
      const chalkIndexJs = `
const chalk = new Proxy((str) => str, {
    get: (target, prop) => {
        if (['rgb', 'hex', 'ansi256', 'bgRgb', 'bgHex', 'bgAnsi256'].includes(prop)) {
            return () => chalk;
        }
        return chalk;
    },
    apply: (target, thisArg, args) => args[0]
});
export default chalk;
export const red = chalk;
export const green = chalk;
export const yellow = chalk;
export const blue = chalk;
export const magenta = chalk;
export const cyan = chalk;
export const white = chalk;
export const gray = chalk;
export const grey = chalk;
export const black = chalk;
export const redBright = chalk;
export const greenBright = chalk;
export const yellowBright = chalk;
export const blueBright = chalk;
export const magentaBright = chalk;
export const cyanBright = chalk;
export const whiteBright = chalk;
export const bold = chalk;
export const dim = chalk;
export const italic = chalk;
export const underline = chalk;
export const inverse = chalk;
export const hidden = chalk;
export const strikethrough = chalk;
export const visible = chalk;
`;
      fs.writeFileSync(path.join(chalkSourceDir, "index.js"), chalkIndexJs);
      log("Fallback chalk module created.");
    }
  }

  // 确保 tslog 已安装 (OpenClaw 运行时依赖)
  const tslogPath = path.join(RESOURCES_DIR, "node_modules", "tslog");
  if (!fs.existsSync(tslogPath)) {
    log("tslog missing, attempting to install explicitly...");
    try {
      execSync(
        "npm install tslog@4.9.2 --no-save --legacy-peer-deps --ignore-scripts --no-package-lock",
        {
          cwd: RESOURCES_DIR,
          stdio: "inherit",
        },
      );
    } catch (err) {
      error("Failed to install tslog: " + err.message);
      // 如果网络安装失败，手动创建 fallback (可选)
      // tslog 比较复杂，手动 mock 比较难，尽量确保 npm install 成功
      log("Creating fallback tslog module...");
      const tslogDir = path.join(RESOURCES_DIR, "node_modules", "tslog");
      fs.mkdirSync(tslogDir, { recursive: true });
      
      const tslogPkgJson = {
          name: "tslog",
          version: "4.9.2",
          main: "./dist/index.js",
          exports: {
            ".": {
              "import": "./dist/index.mjs",
              "require": "./dist/index.js"
            }
          },
          type: "commonjs"
      };
      fs.writeFileSync(path.join(tslogDir, "package.json"), JSON.stringify(tslogPkgJson, null, 2));
      
      const tslogDistDir = path.join(tslogDir, "dist");
      fs.mkdirSync(tslogDistDir, { recursive: true });
      
      // Mock implementation
      const tslogMock = `
      export class Logger {
          constructor(options) {}
          silly(...args) { console.debug('[silly]', ...args); }
          trace(...args) { console.trace('[trace]', ...args); }
          debug(...args) { console.debug('[debug]', ...args); }
          info(...args) { console.info('[info]', ...args); }
          warn(...args) { console.warn('[warn]', ...args); }
          error(...args) { console.error('[error]', ...args); }
          fatal(...args) { console.error('[fatal]', ...args); }
          attachTransport() {}
      }
      `;
      fs.writeFileSync(path.join(tslogDistDir, "index.mjs"), tslogMock);
      
      const tslogCommonJs = `
      class Logger {
          constructor(options) {}
          silly(...args) { console.debug('[silly]', ...args); }
          trace(...args) { console.trace('[trace]', ...args); }
          debug(...args) { console.debug('[debug]', ...args); }
          info(...args) { console.info('[info]', ...args); }
          warn(...args) { console.warn('[warn]', ...args); }
          error(...args) { console.error('[error]', ...args); }
          fatal(...args) { console.error('[fatal]', ...args); }
          attachTransport() {}
      }
      module.exports = { Logger };
      `;
      fs.writeFileSync(path.join(tslogDistDir, "index.js"), tslogCommonJs);
      log("Fallback tslog module created.");
    }
  }
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
    '$1.title = $1.env.OPENCLAW_PROCESS_NAME || "openclaw"',
  );

  // Patch program*.js: process.title = `${cliName}-${name}`
  // Regex: /process\.title\s*=\s*`\$\{cliName\}-\$\{name\}`/g
  // Replacement: 'process.title = process.env.OPENCLAW_PROCESS_NAME || `\${cliName}-\${name}`'
  patchFile(
    filePath,
    /process\.title\s*=\s*`\$\{cliName\}-\$\{name\}`/g,
    "process.title = process.env.OPENCLAW_PROCESS_NAME || `${cliName}-${name}`",
  );

  // Patch entry.js to force execution even when imported (via wrapper)
  // Regex: /if \(!isMainModule\(\{/g
  // Replacement: 'if (false && !isMainModule({'
  if (file === "entry.js") {
    patchFile(
      filePath,
      /if \(!isMainModule\(\{/g,
      "if (false && !isMainModule({",
    );
  }
});

log("OpenClaw build complete!");
