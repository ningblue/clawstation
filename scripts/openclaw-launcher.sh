#!/bin/bash
# ClawStation 内置 OpenClaw 启动器
# 用于将进程名设置为 clawstation-openclaw，避免与外部 OpenClaw 冲突

# macOS 上设置进程名的方法
# 方法1: 使用 launchctl 设置进程标签（仅对 GUI 应用程序有效）
# 方法2: 使用 ps 命令重命名（需要 root 权限）

# 由于 bash 的限制，我们直接使用 exec 替换进程
# 并尝试通过修改 argv[0] 来设置进程名

# 在 macOS 上，可以通过修改 ps 显示的名称
exec -a "clawstation-openclaw" "$@"
