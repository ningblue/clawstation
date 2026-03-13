// src/main/paths.ts
// 统一资源路径管理 - 统一使用 resources/openclaw，移除 lib/openclaw 依赖

import * as path from "path";
import { app } from "electron";

/**
 * 获取 resources/openclaw 的绝对路径
 * 统一使用 resources/openclaw，不再区分开发和生产环境
 */
export function getOpenClawResourcePath(): string {
  // 优先使用 process.resourcesPath（生产环境）
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, "openclaw");
  }

  // 开发环境回退
  return path.join(__dirname, "../../../resources/openclaw");
}

/**
 * 获取 OpenClaw 可执行文件路径
 * 优先使用 wrapper.js，如果不存在则使用 dist/entry.js 或 dist/index.js
 */
export function getOpenClawExecutablePath(): string {
  const resourcePath = getOpenClawResourcePath();

  // 优先顺序：wrapper.js > dist/entry.js > dist/index.js
  const candidates = [
    path.join(resourcePath, "wrapper.js"),
    path.join(resourcePath, "dist/entry.js"),
    path.join(resourcePath, "dist/index.js"),
  ];

  for (const candidate of candidates) {
    if (require("fs").existsSync(candidate)) {
      return candidate;
    }
  }

  // 默认返回 wrapper.js（即使不存在，让调用者处理错误）
  return path.join(resourcePath, "wrapper.js");
}

/**
 * 获取 OpenClaw 配置目录路径
 * 使用 ~/.clawstation/ 作为配置目录
 */
export function getOpenClawConfigDir(): string {
  const os = require("os");
  return path.join(os.homedir(), ".clawstation");
}

/**
 * 获取 scripts 目录路径
 */
export function getScriptsPath(): string {
  if (process.resourcesPath) {
    return path.join(process.resourcesPath, "scripts");
  }

  return path.join(__dirname, "../../../scripts");
}

/**
 * 获取 launcher 脚本路径
 */
export function getLauncherPath(): string | null {
  const scriptsPath = getScriptsPath();
  const launcherPath = path.join(scriptsPath, "clawstation-claw-launcher.js");

  if (require("fs").existsSync(launcherPath)) {
    return launcherPath;
  }

  return null;
}

/**
 * 获取嵌入式 Node.js 路径
 */
export function getEmbeddedNodePath(): string | null {
  const isWindows = process.platform === "win32";
  const resourcesNodePath = path.join(process.resourcesPath || "", "node");

  const candidates = isWindows
    ? [
        path.join(resourcesNodePath, "node.exe"),
        path.join(resourcesNodePath, "bin", "node.exe"),
      ]
    : [
        path.join(resourcesNodePath, "bin", "node"),
        path.join(resourcesNodePath, "node"),
      ];

  for (const candidate of candidates) {
    if (require("fs").existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * 检查 OpenClaw 资源是否存在
 */
export function isOpenClawAvailable(): boolean {
  try {
    const resourcePath = getOpenClawResourcePath();
    const fs = require("fs");

    if (!fs.existsSync(resourcePath)) {
      return false;
    }

    // 检查关键文件是否存在
    const keyFiles = ["dist", "wrapper.js", "package.json"];
    return keyFiles.some(file =>
      fs.existsSync(path.join(resourcePath, file))
    );
  } catch {
    return false;
  }
}
