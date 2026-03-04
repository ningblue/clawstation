#!/bin/bash
# ============================================
# ClawStation 服务管理脚本
# 用于启动、停止和重启 ClawStation 应用及 AI 引擎
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
APP_NAME="clawstation"
OPENCLAW_PORT=18791
BROWSER_PORT=18793
PID_FILE=".clawstation.pid"
LOG_DIR="logs"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    lsof -i :$port 2>/dev/null | grep -v "^COMMAND"
}

# 获取占用端口的进程ID
get_port_pid() {
    local port=$1
    lsof -t -i :$port 2>/dev/null
}

# 停止占用端口的进程
kill_port_process() {
    local port=$1
    local pids=$(get_port_pid $port)

    if [ -n "$pids" ]; then
        log_info "停止占用端口 $port 的进程: $pids"
        echo "$pids" | while read -r pid; do
            if [ -n "$pid" ]; then
                # 检查进程名是否包含 clawstation-engine
                # 使用 args 而不是 comm，因为 process.title 修改的是参数显示
                local process_name=$(ps -p $pid -o args= 2>/dev/null)
                if echo "$process_name" | grep -qi "clawstation-engine"; then
                    log_info "终止内置 AI 引擎进程 (clawstation-engine): $pid"
                    kill -9 $pid 2>/dev/null
                else
                    log_info "跳过非内置 AI 引擎进程: $pid ($process_name)"
                fi
            fi
        done
    fi
}

# 停止 Electron 主进程
kill_electron() {
    local main_pid=$1

    if [ -n "$main_pid" ] && kill -0 $main_pid 2>/dev/null; then
        log_info "停止 Electron 主进程 (PID: $main_pid)..."
        kill $main_pid 2>/dev/null

        # 等待进程结束
        local count=0
        while kill -0 $main_pid 2>/dev/null && [ $count -lt 5 ]; do
            sleep 1
            count=$((count + 1))
        done

        # 如果还在运行，强制终止
        if kill -0 $main_pid 2>/dev/null; then
            log_warn "Electron 主进程未响应，强制终止..."
            kill -9 $main_pid 2>/dev/null
        fi
    fi

    # 停止所有相关子进程（精确匹配 clawstation-engine）
    local child_pids=$(pgrep -f "clawstation-engine" 2>/dev/null | grep -v "^$$")
    if [ -n "$child_pids" ]; then
        log_info "停止相关子进程..."
        echo "$child_pids" | while read -r pid; do
            if [ -n "$pid" ] && [ "$pid" != "$$" ]; then
                kill $pid 2>/dev/null
                sleep 0.5
                kill -9 $pid 2>/dev/null
            fi
        done
    fi
}

# 启动服务
start_service() {
    log_info "启动 ClawStation 服务..."

    # 检查是否已经在运行
    if [ -f "$PROJECT_ROOT/$PID_FILE" ]; then
        local old_pid=$(cat "$PROJECT_ROOT/$PID_FILE")
        if kill -0 $old_pid 2>/dev/null; then
            log_warn "ClawStation 已经在运行 (PID: $old_pid)"
            log_info "如需重启，请使用: $0 restart"
            return 1
        else
            rm -f "$PROJECT_ROOT/$PID_FILE"
        fi
    fi

    # 检查端口占用
    local openclaw_pid=$(get_port_pid $OPENCLAW_PORT)
    if [ -n "$openclaw_pid" ]; then
        log_warn "端口 $OPENCLAW_PORT 被进程 $openclaw_pid 占用"
        log_info "尝试停止旧进程..."
        kill_port_process $OPENCLAW_PORT
        sleep 2
    fi

    # 检查浏览器控制端口
    local browser_pid=$(get_port_pid $BROWSER_PORT)
    if [ -n "$browser_pid" ]; then
        log_warn "端口 $BROWSER_PORT 被进程 $browser_pid 占用"
        kill_port_process $BROWSER_PORT
        sleep 1
    fi

    # 创建日志目录
    mkdir -p "$PROJECT_ROOT/$LOG_DIR"

    # 进入项目目录
    cd "$PROJECT_ROOT"

    # 启动应用
    log_info "启动 ClawStation..."
    npm start > "$PROJECT_ROOT/$LOG_DIR/clawstation.log" 2>&1 &
    local main_pid=$!

    # 保存 PID
    echo $main_pid > "$PROJECT_ROOT/$PID_FILE"

    log_info "等待服务启动..."
    sleep 5

    # 检查是否成功启动
    if kill -0 $main_pid 2>/dev/null; then
        log_success "ClawStation 启动成功 (PID: $main_pid)"
        log_info "应用正在启动，请稍等..."
        log_info "日志文件: $PROJECT_ROOT/$LOG_DIR/clawstation.log"
        return 0
    else
        log_error "ClawStation 启动失败"
        rm -f "$PROJECT_ROOT/$PID_FILE"
        return 1
    fi
}

# 停止服务
stop_service() {
    log_info "停止 ClawStation 服务..."

    local found_process=0

    # 1. 从 PID 文件停止主进程
    if [ -f "$PROJECT_ROOT/$PID_FILE" ]; then
        local main_pid=$(cat "$PROJECT_ROOT/$PID_FILE")
        if [ -n "$main_pid" ]; then
            kill_electron $main_pid
            found_process=1
        fi
        rm -f "$PROJECT_ROOT/$PID_FILE"
    fi

    # 2. 停止占用端口的进程
    local openclaw_pid=$(get_port_pid $OPENCLAW_PORT)
    if [ -n "$openclaw_pid" ]; then
        kill_port_process $OPENCLAW_PORT
        found_process=1
    fi

    local browser_pid=$(get_port_pid $BROWSER_PORT)
    if [ -n "$browser_pid" ]; then
        kill_port_process $BROWSER_PORT
        found_process=1
    fi

    # 3. 停止所有 clawstation-engine 相关进程（精确匹配内置AI引擎）
    local claw_pids=$(pgrep -f "clawstation-engine" 2>/dev/null)
    if [ -n "$claw_pids" ]; then
        log_info "停止内置 AI 引擎进程 (clawstation-engine)..."
        echo "$claw_pids" | while read -r pid; do
            if [ -n "$pid" ] && [ "$pid" != "$$" ]; then
                kill $pid 2>/dev/null
            fi
        done
        sleep 2

        # 强制终止剩余进程
        local remaining=$(pgrep -f "clawstation-engine" 2>/dev/null)
        if [ -n "$remaining" ]; then
            echo "$remaining" | while read -r pid; do
                if [ -n "$pid" ] && [ "$pid" != "$$" ]; then
                    kill -9 $pid 2>/dev/null
                fi
            done
        fi
        found_process=1
    fi

    # 4. 停止 Electron 相关进程
    local electron_pids=$(pgrep -f "Electron" 2>/dev/null)
    if [ -n "$electron_pids" ]; then
        log_info "停止 Electron 进程..."
        echo "$electron_pids" | while read -r pid; do
            # 检查是否是 clawstation 的 Electron 进程
            if ps -p $pid -o args= 2>/dev/null | grep -q "clawstation"; then
                kill $pid 2>/dev/null
                sleep 1
                kill -9 $pid 2>/dev/null
            fi
        done
        found_process=1
    fi

    # 验证端口是否已释放
    sleep 1
    local check_openclaw=$(check_port $OPENCLAW_PORT)
    local check_browser=$(check_port $BROWSER_PORT)

    if [ -z "$check_openclaw" ] && [ -z "$check_browser" ]; then
        log_success "所有服务已停止，端口已释放"
    else
        if [ -n "$check_openclaw" ]; then
            log_error "端口 $OPENCLAW_PORT 仍被占用"
        fi
        if [ -n "$check_browser" ]; then
            log_error "端口 $BROWSER_PORT 仍被占用"
        fi
    fi

    if [ $found_process -eq 0 ]; then
        log_info "没有找到运行中的 ClawStation 进程"
    fi

    # 清理 PID 文件
    rm -f "$PROJECT_ROOT/$PID_FILE"
}

# 重启服务
restart_service() {
    log_info "重启 ClawStation 服务..."
    stop_service
    sleep 3
    start_service
}

# 查看状态
status_service() {
    log_info "检查 ClawStation 服务状态..."

    local running=0

    # 检查 PID 文件
    if [ -f "$PROJECT_ROOT/$PID_FILE" ]; then
        local main_pid=$(cat "$PROJECT_ROOT/$PID_FILE")
        if kill -0 $main_pid 2>/dev/null; then
            log_success "ClawStation 主进程运行中 (PID: $main_pid)"
            running=1
        else
            log_warn "PID 文件存在但进程未运行"
            rm -f "$PROJECT_ROOT/$PID_FILE"
        fi
    fi

    # 检查端口
    local openclaw_info=$(check_port $OPENCLAW_PORT)
    if [ -n "$openclaw_info" ]; then
        log_success "AI 引擎运行中 (端口 $OPENCLAW_PORT)"
        echo "  $openclaw_info"
        running=1
    else
        log_warn "AI 引擎未运行 (端口 $OPENCLAW_PORT)"
    fi

    local browser_info=$(check_port $BROWSER_PORT)
    if [ -n "$browser_info" ]; then
        log_success "浏览器控制服务运行中 (端口 $BROWSER_PORT)"
        echo "  $browser_info"
    else
        log_warn "浏览器控制服务未运行 (端口 $BROWSER_PORT)"
    fi

    # 检查相关进程（精确匹配 clawstation-engine）
    local process_count=$(pgrep -f "clawstation-engine" 2>/dev/null | wc -l)
    if [ $process_count -gt 0 ]; then
        log_info "内置 AI 引擎进程数量: $process_count"
    fi

    if [ $running -eq 0 ]; then
        log_info "ClawStation 当前未运行"
    fi
}

# 查看日志
view_logs() {
    local log_file="$PROJECT_ROOT/$LOG_DIR/clawstation.log"
    if [ -f "$log_file" ]; then
        log_info "查看日志文件: $log_file"
        tail -f "$log_file"
    else
        log_error "日志文件不存在: $log_file"
    fi
}

# 构建应用
build_app() {
    log_info "构建 ClawStation..."
    cd "$PROJECT_ROOT"

    log_info "构建 OpenClaw 内置服务..."
    npm run build:openclaw 2>&1 | tee "$PROJECT_ROOT/$LOG_DIR/build-openclaw.log"
    if [ $? -ne 0 ]; then
        log_error "OpenClaw 构建失败"
        return 1
    fi

    log_info "构建主进程..."
    npm run build:main 2>&1 | tee "$PROJECT_ROOT/$LOG_DIR/build-main.log"
    if [ $? -ne 0 ]; then
        log_error "主进程构建失败"
        return 1
    fi

    log_info "构建渲染进程..."
    npm run build:renderer 2>&1 | tee "$PROJECT_ROOT/$LOG_DIR/build-renderer.log"
    if [ $? -ne 0 ]; then
        log_error "渲染进程构建失败"
        return 1
    fi

    log_success "构建完成"
}

# 清理缓存
clean_cache() {
    log_info "清理缓存..."

    # 清理构建缓存
    rm -rf "$PROJECT_ROOT/dist/renderer/*"

    # 清理 macOS 缓存
    rm -rf ~/Library/Application\ Support/clawstation/Cache
    rm -rf ~/Library/Application\ Support/clawstation/GPUCache

    log_success "缓存已清理"
}

# 完整重新加载（代码变更后使用）
reload_service() {
    log_info "完整重新加载..."

    # 1. 清理缓存
    clean_cache

    # 2. 构建
    log_info "构建渲染进程..."
    cd "$PROJECT_ROOT"
    npm run build:renderer

    # 3. 重启服务
    restart_service
}

# 显示帮助
show_help() {
    echo "============================================"
    echo "ClawStation 服务管理脚本"
    echo "============================================"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start      启动 ClawStation 服务"
    echo "  stop       停止 ClawStation 服务"
    echo "  restart    重启 ClawStation 服务"
    echo "  reload     完整重新加载（清理缓存+构建+重启）"
    echo "  status     查看服务状态"
    echo "  logs       查看实时日志"
    echo "  build      构建应用"
    echo "  clean      清理缓存"
    echo "  help       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start      # 启动服务"
    echo "  $0 stop       # 停止服务"
    echo "  $0 restart    # 重启服务"
    echo "  $0 reload     # 完整重新加载（代码变更后必须使用）"
    echo "  $0 status     # 查看状态"
    echo ""
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
    reload)
        reload_service
        ;;
    status)
        status_service
        ;;
    logs)
        view_logs
        ;;
    build)
        build_app
        ;;
    clean)
        clean_cache
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        log_error "未知命令: $1"
        show_help
        exit 1
        ;;
esac
