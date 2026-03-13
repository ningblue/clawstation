const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const sevenBin = require("7zip-bin");

// 确保 resources 目录存在
const resourcesDir = path.join(__dirname, "../resources");
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

const output7zPath = path.join(resourcesDir, "openclaw.7z");
const sourceDir = path.join(resourcesDir, "openclaw");

// 如果旧的 zip 存在，删除它
const oldZipPath = path.join(resourcesDir, "openclaw.zip");
if (fs.existsSync(oldZipPath)) {
  fs.unlinkSync(oldZipPath);
}

// 如果旧的 7z 存在，删除它
if (fs.existsSync(output7zPath)) {
  fs.unlinkSync(output7zPath);
}

console.log(`正在创建压缩包: ${output7zPath}`);
console.log(`源目录: ${sourceDir}`);
console.log(`使用 7za: ${sevenBin.path7za}`);

// 定义排除规则 (7z 格式)
// 注意：7z 的排除规则是递归的 (-xr!)
const excludePatterns = [
  "docs/*.md", // 排除 docs 根目录下的 md
  "docs/images",
  "docs/assets",
  "node_modules/*.md",
  "node_modules/*.map",
  "node_modules/test",
  "node_modules/tests",
  "node_modules/docs",
  "node_modules/examples",
  "node_modules/.github",
  "node_modules/LICENSE*",
  "node_modules/README*",
  "node_modules/CHANGELOG*",
  "node_modules/AUTHORS*",
  "node_modules/CONTRIBUTORS*",
  "node_modules/*.d.ts",
  "node_modules/*.tsbuildinfo",
  "node_modules/pdfjs-dist/build/*.min.mjs",
  "node_modules/pdfjs-dist/cmaps",
  "node_modules/pdfjs-dist/legacy",
  "node_modules/pdfjs-dist/image_decoders",
  "node_modules/@napi-rs/canvas/**/*.dylib",
  "node_modules/@napi-rs/canvas/**/*.so",
  "node_modules/node-llama-cpp",
];

// 构造排除参数
// const excludeArgs = excludePatterns.map((p) => `-xr!${p}`); // 移除旧的排除逻辑

// ---------------------------------------------------------
// 新增：在压缩前进行物理清理 (比 7z 排除更彻底)
// ---------------------------------------------------------
console.log("正在清理不必要的文件以减小体积...");

const cleanStats = {
  deletedFiles: 0,
  deletedDirs: 0,
  keptTemplates: 0,
};

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  let items;
  try {
    items = fs.readdirSync(dir);
  } catch (e) {
    return;
  }

  for (const item of items) {
    const fullPath = path.join(dir, item);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    // 保护关键路径
    // 必须保留 docs/reference/templates 下的所有内容
    if (fullPath.includes(path.join("docs", "reference", "templates"))) {
      cleanStats.keptTemplates++;
      continue;
    }

    if (stat.isDirectory()) {
      // 要删除的目录列表
      const dirsToRemove = [
        "test",
        "tests",
        "__tests__",
        "example",
        "examples",
        // "doc",
        // "docs", // 注意：除了 templates 外的 docs 都可以删？为了安全，我们只删 node_modules 里的 docs
        "coverage",
        ".github",
        ".vscode",
        ".idea",
        ".git",
        "obj", // build artifacts
      ];

      // 特殊处理：只删除 node_modules 下的 docs，保留根目录的 docs (如果需要)
      // 之前的逻辑是排除 docs/*.md，保留 templates。
      // 这里我们如果是 node_modules 下的 docs，直接删。
      // 如果是根目录下的 docs，只保留 templates。

      const isNodeModules = fullPath.includes("node_modules");

      if (dirsToRemove.includes(item.toLowerCase())) {
        // 如果是根目录的 docs，不能直接全删，要进递归保留 templates
        if (item.toLowerCase() === "docs" && !isNodeModules) {
          // Don't delete root docs dir, recurse into it
        } else {
          // Delete entire directory
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            cleanStats.deletedDirs++;
            continue; // Skip recursion for deleted dir
          } catch (e) {
            console.error(`Failed to delete dir ${fullPath}: ${e.message}`);
          }
        }
      }

      // 递归清理
      cleanDirectory(fullPath);

      // 删除空目录
      try {
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      } catch (e) {}
    } else {
      // 要删除的文件后缀/名称
      const extsToRemove = [
        ".md",
        ".markdown",
        ".ts",
        ".tsx", // 运行时不需要源码
        ".map",
        ".jst",
        ".coffee",
        ".flow",
        ".d.ts",
        ".h",
        ".c",
        ".cpp",
        ".cc", // C++ source
        ".obj",
        ".o",
        ".lib",
        ".a", // build artifacts (keep .node and .dll/.so/dylib)
        ".sln",
        ".vcxproj",
        ".log",
        ".tlog",
        ".lock",
        ".yarn-integrity", // Lock files not needed for runtime
      ];

      const namesToRemove = [
        "LICENSE",
        "LICENSE.txt",
        "LICENSE.md",
        "README",
        "README.md",
        "README.txt",
        "CHANGELOG",
        "CHANGELOG.md",
        "HISTORY",
        "HISTORY.md",
        "CONTRIBUTING",
        "CONTRIBUTING.md",
        "AUTHORS",
        "OWNERS",
        ".npmignore",
        ".gitattributes",
        ".editorconfig",
        ".eslintrc",
        ".eslintrc.js",
        ".eslintrc.json",
        ".prettierrc",
        ".prettierrc.json",
        ".travis.yml",
        "appveyor.yml",
        "circle.yml",
        "tsconfig.json",
      ];

      const ext = path.extname(item).toLowerCase();
      const name = item;

      // 检查是否在 node_modules 中
      // 如果不在 node_modules 中 (例如 dist 目录)，要小心删除
      const isNodeModules = fullPath.includes("node_modules");

      // 保护策略：不要删除代码文件 (.js, .mjs, .cjs, .json, .node)
      // 即使它们匹配 namesToRemove (比如 changelog.js)
      const isCodeFile = [".js", ".mjs", ".cjs", ".json", ".node"].includes(
        ext,
      );

      let shouldDelete = false;

      if (isNodeModules) {
        if (extsToRemove.includes(ext)) shouldDelete = true;
        if (namesToRemove.some((n) => name.toUpperCase().startsWith(n)))
          shouldDelete = true;

        // 如果是代码文件，即使匹配了 namesToRemove (例如 changelog.js)，也不要删除
        // 除非它是明确在 extsToRemove 里的 (例如 .ts, .map)
        if (isCodeFile && !extsToRemove.includes(ext)) {
          shouldDelete = false;
        }
      } else {
        // 对于非 node_modules 文件 (如 dist, docs 根目录)
        // 删除 .map, .ts 是安全的
        if ([".map", ".ts", ".tsx"].includes(ext)) shouldDelete = true;
        // 根目录下的 LICENSE/README 可能想保留？OpenClaw 根目录的 README 可能没用。
        if (namesToRemove.some((n) => name === n)) shouldDelete = true;
      }

      if (shouldDelete) {
        try {
          fs.unlinkSync(fullPath);
          cleanStats.deletedFiles++;
        } catch (e) {}
      }
    }
  }
}

// 执行清理
cleanDirectory(sourceDir);
console.log(
  `清理完成: 删除了 ${cleanStats.deletedFiles} 个文件, ${cleanStats.deletedDirs} 个目录`,
);
console.log(`保留了 ${cleanStats.keptTemplates} 个模板文件 (检查点)`);

try {
  // 1. 主要压缩命令
  // a: 添加到压缩包
  // -mx=3: 快速压缩 (平衡速度和体积，默认是 5，极限是 9)
  // -ms=on: 固实压缩
  // -mmt=on: 多线程
  console.log("正在执行 7z 压缩...");

  // 此时源目录已经很干净了，不需要复杂的排除参数
  // 只需要打包所有内容

  const baseArgs = ["a", output7zPath, ".", "-mx=3", "-ms=on", "-mmt=on"];

  // 执行主压缩
  console.log("Step 1: Main compression (mx=3)...");
  execSync(`"${sevenBin.path7za}" a "${output7zPath}" . -mx=3 -ms=on -mmt=on`, {
    cwd: sourceDir,
    stdio: "inherit",
  });

  // 2. 模板文件已经在 sourceDir 里了（因为 cleanDirectory 保护了它），所以不需 要额外追加。
  // 除非之前逻辑是它们不在 sourceDir，而是从别处 copy？
  // build-openclaw.js 已经把 templates copy 到了 resources/openclaw/docs/reference/templates。
  // 所以它们就在那里。

  const stats = fs.statSync(output7zPath);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(
    `\n压缩完成！\n文件: ${output7zPath}\n大小: ${stats.size} 字节 (${sizeInMB} MB)`,
  );

  // ---------------------------------------------------------
  // 新增：复制 7za.exe 到 resources 目录 (仅 Windows 需要)
  // ---------------------------------------------------------
  // 这样做是为了在安装过程中使用静态的 7za.exe，而不是尝试动态释放它
  // 避免 InitPluginsDir 和 File 指令带来的潜在崩溃问题
  if (process.platform === "win32") {
    console.log("正在复制 7za.exe 到 resources...");
    const dest7za = path.join(resourcesDir, "7za.exe");
    fs.copyFileSync(sevenBin.path7za, dest7za);
    console.log(`7za.exe 已复制到: ${dest7za}`);
  }
} catch (e) {
  console.error("压缩失败:", e);
  process.exit(1);
}
