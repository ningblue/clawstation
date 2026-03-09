#!/bin/bash

# X-Claw 服务管理脚本
# 用于安全地启动、停止和管理 X-Claw 应用及 OpenClaw 服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
PID_FILE="$PROJECT_DIR/.clawstation.pid"
LOG_DIR="$PROJECT_DIR/logs"
MAIN_LOG="$HOME/Library/Logs/X-Claw/main.log"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

# 获取脚本名称
SCRIPT_NAME=$(basename "$0")

# 显示帮助信息
show_help() {
    echo -e "${BLUE}X-Claw 服务管理脚本${NC}"
    echo ""
    echo "用法: ./$SCRIPT_NAME [命令]"
    echo ""
    echo "命令:"
    echo "  start     启动 X-Claw 应用和 OpenClaw 服务"
    echo "  stop      安全停止 X-Claw 和 OpenClaw 服务"
    echo "  restart   重启服务"
    echo "  status    查看服务运行状态"
    echo "  logs      查看实时日志"
    echo "  dev       以开发模式启动（带热重载）"
    echo "  build     构建应用"
    echo "  clean     清理所有进程（危险操作，仅紧急使用）"
    echo ""
    echo "示例:"
    echo "  ./$SCRIPT_NAME start     # 启动服务"
    echo "  ./$SCRIPT_NAME stop      # 停止服务"
    echo "  ./$SCRIPT_NAME status    # 查看状态"
}

# 配置
OPENCLAW_PORT=18791

# 检查服务是否正在运行
check_status() {
    local electron_pid=""
    local openclaw_pid=""

    # 检查 Electron 进程
    if [ -f "$PID_FILE" ]; then
        electron_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$electron_pid" ] && kill -0 "$electron_pid" 2>/dev/null; then
            echo -e "${GREEN}✓ X-Claw 应用正在运行 (PID: $electron_pid)${NC}"
        else
            echo -e "${RED}✗ X-Claw 应用未运行${NC}"
            rm -f "$PID_FILE"
            electron_pid=""
        fi
    else
        # 尝试查找 Electron 进程
        electron_pid=$(pgrep -f "$PROJECT_DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" | head -1)
        if [ -n "$electron_pid" ]; then
            echo -e "${GREEN}✓ X-Claw 应用正在运行 (PID: $electron_pid)${NC}"
            echo "$electron_pid" > "$PID_FILE"
        else
            echo -e "${RED}✗ X-Claw 应用未运行${NC}"
        fi
    fi

    # 检查 OpenClaw 服务
    openclaw_pid=$(pgrep -f "clawstation-engine" | head -1)
    if [ -n "$openclaw_pid" ]; then
        echo -e "${GREEN}✓ OpenClaw 服务正在运行 (PID: $openclaw_pid)${NC}"
        # 检查端口
        if lsof -i :$OPENCLAW_PORT >/dev/null 2>&1; then
            echo -e "${GREEN}✓ OpenClaw 监听端口 $OPENCLAW_PORT${NC}"
        else
            echo -e "${YELLOW}⚠ OpenClaw 进程存在但未监听端口 $OPENCLAW_PORT${NC}"
        fi
    else
        echo -e "${RED}✗ OpenClaw 服务未运行${NC}"
    fi

    if [ -z "$electron_pid" ] && [ -z "$openclaw_pid" ]; then
        return 1
    fi
    return 0
}

# 启动服务
start_service() {
    echo -e "${BLUE}正在启动 X-Claw...${NC}"

    # 检查是否已经在运行
    if [ -f "$PID_FILE" ]; then
        local existing_pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠ X-Claw 已经在运行 (PID: $existing_pid)${NC}"
            echo -e "${YELLOW}   使用 './$SCRIPT_NAME restart' 重启或 './$SCRIPT_NAME stop' 停止${NC}"
            return 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    # 检查并确保 dist/renderer/index.html 存在
    if [ ! -f "$PROJECT_DIR/dist/renderer/index.html" ]; then
        echo -e "${YELLOW}⚠ dist/renderer/index.html 不存在，正在复制...${NC}"
        cp "$PROJECT_DIR/src/renderer/index.html" "$PROJECT_DIR/dist/renderer/index.html"
    fi

    # 启动应用
    cd "$PROJECT_DIR"
    echo -e "${BLUE}启动 Electron 应用...${NC}"

    # 后台启动并记录 PID
    npm start > "$LOG_DIR/app.log" 2>&1 &
    local app_pid=$!
    echo $app_pid > "$PID_FILE"

    # 等待应用启动
    echo -e "${BLUE}等待应用启动...${NC}"
    local count=0
    while [ $count -lt 30 ]; do
        sleep 1
        if kill -0 $app_pid 2>/dev/null; then
            # 检查 OpenClaw 是否启动
            if lsof -i :$OPENCLAW_PORT >/dev/null 2>&1; then
                echo -e "${GREEN}✓ X-Claw 启动成功！${NC}"
                echo -e "${GREEN}✓ OpenClaw 服务已运行在端口 $OPENCLAW_PORT${NC}"
                echo ""
                echo -e "${BLUE}应用日志: tail -f '$MAIN_LOG'${NC}"
                echo -e "${BLUE}查看状态: ./$SCRIPT_NAME status${NC}"
                return 0
            fi
        else
            echo -e "${RED}✗ 应用启动失败${NC}"
            rm -f "$PID_FILE"
            return 1
        fi
        count=$((count + 1))
        echo -n "."
    done

    echo ""
    echo -e "${YELLOW}⚠ 启动超时，但应用可能仍在启动中${NC}"
    echo -e "${BLUE}查看日志: tail -f '$MAIN_LOG'${NC}"
    return 0
}

# 停止服务
stop_service() {
    echo -e "${BLUE}正在停止 X-Claw...${NC}"

    local stopped=false

    # 停止 Electron 应用
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo -e "${BLUE}停止 Electron 应用 (PID: $pid)...${NC}"
            kill "$pid" 2>/dev/null
            local count=0
            while [ $count -lt 10 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                count=$((count + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}强制终止 Electron 应用...${NC}"
                kill -9 "$pid" 2>/dev/null || true
            fi
            stopped=true
        fi
        rm -f "$PID_FILE"
    fi

    # 查找并停止其他 Electron 进程（项目相关）
    local electron_pids=$(pgrep -f "$PROJECT_DIR/node_modules/electron/dist/Electron.app" || true)
    if [ -n "$electron_pids" ]; then
        echo -e "${BLUE}停止 Electron 进程...${NC}"
        for pid in $electron_pids; do
            kill "$pid" 2>/dev/null || true
        done
        sleep 2
        stopped=true
    fi

    # 停止 OpenClaw 服务
    local openclaw_pids=$(pgrep -f "clawstation-engine" || true)
    if [ -n "$openclaw_pids" ]; then
        echo -e "${BLUE}停止 OpenClaw 服务...${NC}"
        for pid in $openclaw_pids; do
            kill "$pid" 2>/dev/null || true
        done
        sleep 1
        stopped=true
    fi

    # 停止 node electron 进程
    local node_pids=$(pgrep -f "node.*electron" | grep -v grep | grep clawstation || true)
    if [ -n "$node_pids" ]; then
        for pid in $node_pids; do
            kill "$pid" 2>/dev/null || true
        done
    fi

    if [ "$stopped" = true ]; then
        echo -e "${GREEN}✓ X-Claw 已停止${NC}"
    else
        echo -e "${YELLOW}⚠ 没有运行的服务需要停止${NC}"
    fi
}

# 重启服务
restart_service() {
    echo -e "${BLUE}重启 X-Claw...${NC}"
    stop_service
    sleep 2
    start_service
}

# 查看日志
show_logs() {
    echo -e "${BLUE}查看日志 (按 Ctrl+C 退出)...${NC}"
    if [ -f "$MAIN_LOG" ]; then
        tail -f "$MAIN_LOG"
    else
        echo -e "${RED}✗ 日志文件不存在: $MAIN_LOG${NC}"
        echo -e "${BLUE}尝试查看应用日志...${NC}"
        tail -f "$LOG_DIR/app.log" 2>/dev/null || echo -e "${RED}✗ 应用日志也不存在${NC}"
    fi
}

# 开发模式
dev_mode() {
    echo -e "${BLUE}以开发模式启动 X-Claw...${NC}"

    # 检查并确保 dist/renderer/index.html 存在
    if [ ! -f "$PROJECT_DIR/dist/renderer/index.html" ]; then
        echo -e "${YELLOW}⚠ dist/renderer/index.html 不存在，正在复制...${NC}"
        cp "$PROJECT_DIR/src/renderer/index.html" "$PROJECT_DIR/dist/renderer/index.html"
    fi

    cd "$PROJECT_DIR"
    echo -e "${BLUE}启动开发服务器 (带热重载)...${NC}"
    echo -e "${YELLOW}提示: 按 Ctrl+C 停止${NC}"
    npm run dev
}

# 构建应用
build_app() {
    echo -e "${BLUE}构建 X-Claw 应用...${NC}"
    cd "$PROJECT_DIR"
    npm run build
    echo -e "${GREEN}✓ 构建完成${NC}"
}

# 清理所有进程（危险操作）
clean_all() {
    echo -e "${RED}⚠ 警告: 这将强制终止所有 Electron 和 OpenClaw 进程${NC}"
    echo -e "${RED}⚠ 此操作可能导致数据丢失，请确保已保存所有工作${NC}"
    echo ""
    read -p "确定要继续吗? (输入 'yes' 确认): " confirm

    if [ "$confirm" = "yes" ]; then
        echo -e "${RED}强制终止所有进程...${NC}"
        pkill -9 -f "electron" 2>/dev/null || true
        pkill -9 -f "clawstation-engine" 2>/dev/null || true
        rm -f "$PID_FILE"
        echo -e "${GREEN}✓ 清理完成${NC}"
    else
        echo -e "${BLUE}已取消${NC}"
    fi
}

# 主逻辑
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    dev)
        dev_mode
        ;;
    build)
        build_app
        ;;
    clean)
        clean_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知命令 '${1:-}'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
