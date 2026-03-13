# 任务列表

- [x] 任务 1：添加构建脚本压缩能力
  - [x] 子任务 1.1：安装 `archiver` 作为开发依赖，用于跨平台压缩文件。
  - [x] 子任务 1.2：创建 `scripts/archive-openclaw.js` 脚本，将 `resources/openclaw` 压缩为 `resources/openclaw.zip`。
  - [x] 子任务 1.3：更新 `package.json` 的构建脚本，在运行 `electron-builder` 之前执行压缩脚本。

- [x] 任务 2：更新 Electron Builder 配置
  - [x] 子任务 2.1：修改 `electron-builder.yml`，从 `extraResources` 中移除 `resources/openclaw` 目录。
  - [x] 子任务 2.2：将 `resources/openclaw.zip` 添加到 `extraResources`。
  - [x] 子任务 2.3：移除 `asarUnpack` 中关于 `openclaw` 的冗余配置。
  - [x] 子任务 2.4：显式设置 `compression: normal`（或 `store`）以优化性能。

- [x] 任务 3：实现安装程序解压与清理逻辑
  - [x] 子任务 3.1：修改 `scripts/installer.nsh`，添加自定义安装宏 `customInstall`。
  - [x] 子任务 3.2：在宏中添加逻辑：先删除 `$INSTDIR\resources\openclaw` 目录（如果存在）。
  - [x] 子任务 3.3：实现基于 PowerShell 的解压逻辑，将 `openclaw.zip` 解压到 `$INSTDIR\resources`。
  - [x] 子任务 3.4：确保脚本在解压后删除 zip 文件。

- [x] 任务 4：清理工作
  - [x] 子任务 4.1：确保构建后的临时 zip 文件被清理或添加到 `.gitignore` 中。
