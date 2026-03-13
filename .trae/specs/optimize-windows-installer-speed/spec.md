# Windows 安装包速度优化规范

## 为什么需要优化
用户反馈 Windows 安装过程耗时过长（10-20分钟）。经过分析，主要原因是 NSIS 安装程序在安装过程中需要解压和写入成千上万个小文件（主要集中在 `openclaw` 目录及其依赖中）。Windows 文件系统的写入操作和杀毒软件对每个小文件的实时扫描是主要的性能瓶颈。

## 变更内容
- **资源压缩**：在构建过程中，将 `resources/openclaw` 目录压缩为单个 `openclaw.zip` 文件。
- **安装逻辑**：NSIS 安装程序将只复制这一个 zip 文件，而不是成千上万个小文件。
- **安装后解压**：编写自定义 NSIS 脚本，在安装过程中使用 PowerShell（或内置工具）将 `openclaw.zip` 解压到安装目录。
- **升级兼容性**：在解压之前，脚本会强制删除旧的 `resources/openclaw` 目录，确保升级用户也能获得干净的新环境，避免文件冲突或残留。
- **配置清理**：移除 `electron-builder.yml` 中针对 `openclaw` 的冗余 `asarUnpack` 配置。

## 影响范围
- **安装速度**：预期安装时间将从约 15 分钟大幅缩短至 1 分钟以内。
- **构建流程**：在 Electron 构建之前增加了一个压缩步骤。
- **升级体验**：
  - **覆盖安装**：旧版本用户安装新版本时，旧的 `openclaw` 文件夹会被自动清理并替换为新解压的内容，过程无缝兼容。
  - **自动更新**：通过 `electron-updater` 进行的全量更新也会执行相同的安装脚本，确保更新后的文件一致性。

## 新增需求
### 需求：资源压缩
构建系统必须在打包安装程序之前，将 `resources/openclaw` 压缩为 `resources/openclaw.zip`。

### 需求：安装时解压与清理
Windows 安装程序必须在安装过程中执行以下步骤：
1. 检查是否存在旧的 `resources/openclaw` 目录。
2. 如果存在，**递归删除** 该目录及其所有内容（防止旧文件残留）。
3. 将 `resources/openclaw.zip` 解压到 `resources/openclaw`。
4. 解压完成后删除 `resources/openclaw.zip`。

#### 场景：升级安装
- **当** 用户在已安装旧版本的机器上运行新版安装程序
- **则** 旧的 `resources/openclaw` 文件夹被完全删除
- **且** 新的 `openclaw.zip` 被解压
- **且** 用户获得纯净的新版本环境

## 修改需求
### 需求：Electron Builder 配置
修改 `electron-builder.yml` 以打包 zip 文件而不是原始目录。
