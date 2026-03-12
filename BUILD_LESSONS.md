# Electron 构建经验教训

## 问题描述

在尝试为 Electron 40+ 无签名 macOS 构建添加 "修复" 时，引入了新的问题，导致安装后的应用无法启动。

### 错误表现

```
RBSRequestErrorDomain Code=5 "Launch failed."
NSPOSIXErrorDomain Code=163 "Unknown error: 163"
```

## 根本原因

**过度修复导致的问题**。添加以下代码破坏了应用：

1. **flipFuses 修改二进制文件**
   - 使用 `@electron/fuses` 的 `flipFuses` 修改 Electron 主二进制文件
   - 可能导致二进制文件损坏或签名验证失败

2. **手动移除 ElectronAsarIntegrity**
   - 使用 `plutil -remove` 从 Info.plist 移除键值
   - 可能破坏 plist 结构或触发其他验证机制

## 解决过程

### 正确的排查方法

1. **还原到原始状态**
   ```bash
   git checkout -- scripts/after-pack.js
   ```

2. **清理构建产物**
   ```bash
   rm -rf release/mac-arm64 release/mac release/*.dmg
   ```

3. **重新构建**
   ```bash
   npx electron-builder --mac --arm64
   ```

4. **测试验证**
   - 构建目录直接运行
   - DMG 挂载运行
   - 安装到 /Applications 运行
   - Finder 双击启动

### 结果

还原到原始状态后，构建完全正常，所有测试场景通过：
- ✅ 构建目录直接运行
- ✅ DMG 挂载运行
- ✅ 安装到 /Applications
- ✅ Finder 双击启动

## 经验教训

### 1. 不要预优化

- 不要为了"预防"潜在问题而添加未经充分测试的代码
- 如果原始构建流程能工作，就不要修改它

### 2. Electron 构建的特殊性

- 本地开发模式能运行 ≠ 打包后应用能运行
- 但反过来：如果构建流程原本正常，就不需要"修复"
- electron-builder 会自动处理 Electron 40+ 的无签名构建配置

### 3. 修改构建脚本的流程

```
怀疑构建问题 → 先还原测试 → 确认原始状态是否正常 → 如正常则不修改
                                    ↓ 如确实有问题
                              最小化修改 → 完整测试 → 验证通过
```

### 4. 危险操作黑名单

| 操作 | 风险 | 建议 |
|-----|------|------|
| `flipFuses` 修改 Electron 二进制 | 可能损坏二进制或破坏签名链 | 除非确定需要，否则避免使用 |
| `plutil -remove` 修改 Info.plist | 可能破坏 plist 结构 | 使用 electron-builder 的 `extendInfo` 配置 |
| `codesign --remove-signature` | 正常操作，但配合其他修改可能出问题 | 保持现状，正常工作 |

### 5. 测试标准

任何构建脚本的修改都必须通过以下测试：

1. 构建成功无报错
2. 安装包能正常挂载/安装
3. 安装后的应用能双击启动
4. 应用功能正常（渲染进程、主进程、API 调用）

## 参考信息

### ElectronAsarIntegrity 机制

Electron 40+ 引入了 ASAR 完整性验证：
- 打包时计算 app.asar 的哈希值
- 存储在 Info.plist 的 `ElectronAsarIntegrity` 键中
- 运行时验证哈希值是否匹配

**无签名构建时**：
- electron-builder 会自动处理相关配置
- **不要**手动干预此机制
- **不要**尝试禁用相关 fuses

### 相关错误码

- `RBSRequestErrorDomain Code=5`: 启动失败，通常是签名或二进制验证问题
- `NSPOSIXErrorDomain Code=163`: 底层系统错误，可能与损坏的二进制文件有关

## 结论

**如果构建流程原本工作正常，就不要修改它。**

Electron 40+ 的无签名 macOS 构建在 electron-builder 中已经有完善的处理，不需要额外的"修复"。
