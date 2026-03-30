const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const sevenBin = require("7zip-bin");

// 确保 resources 目录存在
const resourcesDir = path.join(__dirname, "../resources");
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

const sourceDir = path.join(resourcesDir, "openclaw");
const ARCHITECTURES = ["arm64", "x64"];

// 如果旧的 zip 存在，删除它
const oldZipPath = path.join(resourcesDir, "openclaw.zip");
if (fs.existsSync(oldZipPath)) {
  fs.unlinkSync(oldZipPath);
}

// 如果旧的单架构 7z 存在，删除它
const old7zPath = path.join(resourcesDir, "openclaw.7z");
if (fs.existsSync(old7zPath)) {
  fs.unlinkSync(old7zPath);
}

// 为每个架构创建压缩包
for (const arch of ARCHITECTURES) {
  const archSourceDir = path.join(sourceDir, arch);
  const output7zPath = path.join(resourcesDir, `openclaw-${arch}.7z`);

  // 如果旧的 7z 存在，删除它
  if (fs.existsSync(output7zPath)) {
    fs.unlinkSync(output7zPath);
  }

  if (!fs.existsSync(archSourceDir)) {
    console.error(`❌ Architecture directory not found: ${archSourceDir}`);
    console.error(`Please run 'npm run build:openclaw' first.`);
    process.exit(1);
  }

  console.log(`\n📦 Creating archive for ${arch}...`);
  console.log(`Source: ${archSourceDir}`);
  console.log(`Output: ${output7zPath}`);

  // 清理不必要的文件
  console.log(`🧹 Cleaning up ${arch} directory...`);
  cleanDirectory(archSourceDir);

  try {
    // Ensure 7za binary is executable (npm install --ignore-scripts may skip chmod)
    try {
      fs.chmodSync(sevenBin.path7za, 0o755);
    } catch (e) {
      // ignore
    }

    execSync(`"${sevenBin.path7za}" a "${output7zPath}" . -mx=3 -ms=on -mmt=on`, {
      cwd: archSourceDir,
      stdio: "inherit",
    });

    const stats = fs.statSync(output7zPath);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ ${arch}: ${sizeInMB} MB`);
  } catch (e) {
    console.error(`❌ Failed to create archive for ${arch}:`, e.message);
    process.exit(1);
  }
}

// 删除源目录（已压缩成架构特定的包）
console.log("\n🗑️  Cleaning up source directory...");
fs.rmSync(sourceDir, { recursive: true, force: true });

console.log("\n✅ All archives created successfully!");

/**
 * 清理目录中的不必要文件
 */
function cleanDirectory(dir) {
  const stats = {
    deletedFiles: 0,
    deletedDirs: 0,
  };

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    let items;
    try {
      items = fs.readdirSync(currentDir);
    } catch (e) {
      return;
    }

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }

      if (stat.isDirectory()) {
        // 删除不必要的目录
        const dirsToRemove = [
          "test", "tests", "__tests__",
          "example", "examples",
          "coverage",
          ".github", ".vscode", ".idea", ".git",
          "obj",
        ];

        const isNodeModules = fullPath.includes("node_modules");

        if (dirsToRemove.includes(item.toLowerCase())) {
          if (item.toLowerCase() === "docs" && !isNodeModules) {
            // 保留根目录 docs，递归清理
            walk(fullPath);
          } else {
            try {
              fs.rmSync(fullPath, { recursive: true, force: true });
              stats.deletedDirs++;
              continue;
            } catch (e) {}
          }
        } else {
          walk(fullPath);
        }
      } else {
        // 删除不必要的文件
        const extsToRemove = [
          ".md", ".markdown",
          ".ts", ".tsx",
          ".map",
          ".d.ts",
          ".h", ".c", ".cpp", ".cc",
          ".obj", ".o", ".lib", ".a",
          ".sln", ".vcxproj",
        ];

        const namesToRemove = [
          "LICENSE", "LICENSE.txt", "LICENSE.md",
          "README", "README.md", "README.txt",
          "CHANGELOG", "CHANGELOG.md",
          "CONTRIBUTING", "CONTRIBUTING.md",
          ".npmignore", ".gitattributes",
          ".eslintrc", ".prettierrc", "tsconfig.json",
        ];

        const ext = path.extname(item).toLowerCase();
        const isCodeFile = [".js", ".mjs", ".cjs", ".json", ".node"].includes(ext);
        const isNodeModules = fullPath.includes("node_modules");

        let shouldDelete = false;

        if (isNodeModules) {
          if (extsToRemove.includes(ext)) shouldDelete = true;
          if (namesToRemove.some((n) => item.toUpperCase().startsWith(n))) {
            shouldDelete = !isCodeFile; // 不删除代码文件
          }
        } else {
          if ([".map", ".ts", ".tsx"].includes(ext)) shouldDelete = true;
        }

        if (shouldDelete) {
          try {
            fs.unlinkSync(fullPath);
            stats.deletedFiles++;
          } catch (e) {}
        }
      }
    }
  }

  walk(dir);
  console.log(`  Cleaned: ${stats.deletedFiles} files, ${stats.deletedDirs} dirs`);
}
