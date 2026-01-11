#!/bin/bash

# Next.js AI Draw.io Deployment Script
# This script deploys the Next.js application to the server

set -e  # Exit on error

APP_NAME="next-ai-draw-io"
DEPLOY_DIR="/tmp/deploy-next-ai-draw-io"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="${APP_NAME}.service"
PORT=${PORT:-6002}

# Find Node.js executable (check common locations)
if command -v node &> /dev/null; then
    NODE_CMD=$(which node)
elif [ -f /usr/local/bin/node ]; then
    NODE_CMD="/usr/local/bin/node"
elif [ -f /usr/bin/node ]; then
    NODE_CMD="/usr/bin/node"
else
    NODE_CMD="node"
fi

echo "======================================"
echo "开始部署 ${APP_NAME}"
echo "======================================"

# Check if deployment directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "错误: 部署目录不存在: $DEPLOY_DIR"
    exit 1
fi

# Display Node.js version and check compatibility
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "Node.js 版本: $NODE_VERSION"
    echo "npm 版本: $(npm --version || echo '未安装')"
    echo "Node.js 路径: $(which node)"
    
    # Check Node.js version (should be 20+ or 24+)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "⚠️  警告: Node.js 版本 $NODE_VERSION 可能不兼容"
        echo "   推荐使用 Node.js 20+ 或 24+"
        echo "   请参考 docs/SERVER_NODEJS_SETUP.md 升级 Node.js"
    fi
else
    echo "❌ 错误: 未找到 Node.js 命令"
    echo "   请安装 Node.js 20+ 或 24+"
    echo "   参考: docs/SERVER_NODEJS_SETUP.md"
    exit 1
fi

# Create application directory if it doesn't exist
sudo mkdir -p "$APP_DIR"

# Stop the service if it's running
echo "停止服务..."
sudo systemctl stop "$SERVICE_NAME" || true

# Copy new files
echo "复制新文件..."
sudo rm -rf "$APP_DIR"/*
sudo cp -r "$DEPLOY_DIR"/* "$APP_DIR/"

# Set correct ownership (use the user running the script)
DEPLOY_USER=$(whoami)
sudo chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"

# Standalone build mode
# Check for standalone build in .next/standalone directory
if [ -d "$APP_DIR/.next/standalone" ] && [ -f "$APP_DIR/.next/standalone/server.js" ]; then
    echo "检测到 standalone 构建模式"
    cd "$APP_DIR/.next/standalone"
    
    # Create symlinks for public and .next/static
    if [ -d "$APP_DIR/public" ]; then
        ln -sf "$APP_DIR/public" ./public || true
    fi
    if [ -d "$APP_DIR/.next/static" ]; then
        mkdir -p .next
        ln -sf "$APP_DIR/.next/static" ./.next/static || true
    fi
    
    SERVER_SCRIPT="$APP_DIR/.next/standalone/server.js"
else
    echo "错误: 未找到 standalone 构建文件"
    echo "请确保使用 standalone 模式构建 (next.config.ts 中设置 output: 'standalone')"
    exit 1
fi

# Set up environment variables if .env.production exists
if [ -f "$APP_DIR/.env.production" ]; then
    echo "发现生产环境配置文件"
    mv "$APP_DIR/.env.production" "$APP_DIR/.env.local" || true
fi

# Verify server script exists
if [ ! -f "$SERVER_SCRIPT" ]; then
    echo "错误: 服务器脚本不存在: $SERVER_SCRIPT"
    exit 1
fi

# Verify node command exists and is executable
if [ ! -f "$NODE_CMD" ] && ! command -v "$NODE_CMD" &> /dev/null; then
    echo "错误: Node.js 命令不存在: $NODE_CMD"
    echo "请确保 Node.js 已正确安装"
    exit 1
fi

# Resolve symlink to actual path
if [ -L "$NODE_CMD" ]; then
    echo "检测到 Node.js 符号链接，解析实际路径..."
    NODE_ACTUAL=$(readlink -f "$NODE_CMD")
    echo "符号链接: $NODE_CMD -> $NODE_ACTUAL"
    NODE_CMD="$NODE_ACTUAL"
    echo "使用实际路径: $NODE_CMD"
fi

# Verify node is executable
if [ -f "$NODE_CMD" ] && [ ! -x "$NODE_CMD" ]; then
    echo "警告: Node.js 文件不可执行，尝试添加执行权限..."
    sudo chmod +x "$NODE_CMD" || echo "无法添加执行权限"
fi

# Test node execution
if ! "$NODE_CMD" --version &> /dev/null; then
    echo "警告: 无法执行 Node.js，请检查权限"
    ls -l "$NODE_CMD" || true
fi

# Update service file with correct paths
echo "配置 systemd 服务..."
echo "服务器脚本: $SERVER_SCRIPT"
echo "Node.js 命令: $NODE_CMD"
# Get the directory of the server script
SERVER_DIR=$(dirname "$SERVER_SCRIPT")
echo "工作目录: $SERVER_DIR"

# Create a temporary service file with correct paths
TEMP_SERVICE=$(mktemp)
cp "$APP_DIR/$SERVICE_NAME" "$TEMP_SERVICE"

# Update paths using sed (no sudo needed for temp file)
# Use /bin/sh -c to ensure proper execution environment
sed -i "s|^ExecStart=.*|ExecStart=/bin/sh -c \"$NODE_CMD $SERVER_SCRIPT\"|" "$TEMP_SERVICE"
sed -i "s|^WorkingDirectory=.*|WorkingDirectory=$SERVER_DIR|" "$TEMP_SERVICE"

# Update User to match deploy user if needed
DEPLOY_USER=$(whoami)
sed -i "s|^User=.*|User=$DEPLOY_USER|" "$TEMP_SERVICE"
sed -i "s|^Group=.*|Group=$DEPLOY_USER|" "$TEMP_SERVICE"

# Fix systemd security settings to allow Node.js execution
NODE_DIR=$(dirname "$NODE_CMD")
echo "Node.js 目录: $NODE_DIR"

# Adjust systemd security settings to allow Node.js execution
if [[ "$NODE_DIR" == "/usr/local/bin" ]] || [[ "$NODE_DIR" == "/usr/bin" ]]; then
    echo "调整 systemd 安全设置以允许执行 Node.js..."
    # Completely remove ProtectSystem to allow execution
    # This is necessary because ProtectSystem=strict/true can block execution
    sed -i "/^ProtectSystem=/d" "$TEMP_SERVICE"
    echo "已移除 ProtectSystem 限制"
fi

# Ensure PATH is set for the service user (only once, before ExecStart)
if ! grep -q "^Environment=PATH=" "$TEMP_SERVICE"; then
    # Find the last Environment line and add PATH after it
    LAST_ENV_LINE=$(grep -n "^Environment=" "$TEMP_SERVICE" | tail -1 | cut -d: -f1)
    if [ -n "$LAST_ENV_LINE" ]; then
        sed -i "${LAST_ENV_LINE}a Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$TEMP_SERVICE"
        echo "已添加 PATH 环境变量"
    else
        # If no Environment line exists, add before ExecStart
        sed -i "/^ExecStart=/i Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$TEMP_SERVICE"
        echo "已添加 PATH 环境变量（在 ExecStart 之前）"
    fi
fi

# Remove duplicate PATH entries - keep only the first one
PATH_COUNT=$(grep -c "^Environment=PATH=" "$TEMP_SERVICE" || echo "0")
if [ "$PATH_COUNT" -gt 1 ]; then
    echo "发现重复的 PATH 环境变量，正在清理..."
    # Keep only the first PATH entry, remove the rest
    FIRST_PATH_LINE=$(grep -n "^Environment=PATH=" "$TEMP_SERVICE" | head -1 | cut -d: -f1)
    # Remove all PATH lines
    sed -i '/^Environment=PATH=/d' "$TEMP_SERVICE"
    # Re-add only one PATH line after the last Environment line
    LAST_ENV_LINE=$(grep -n "^Environment=" "$TEMP_SERVICE" | tail -1 | cut -d: -f1)
    if [ -n "$LAST_ENV_LINE" ]; then
        sed -i "${LAST_ENV_LINE}a Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$TEMP_SERVICE"
    else
        sed -i "/^ExecStart=/i Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$TEMP_SERVICE"
    fi
    echo "已清理重复的 PATH 环境变量"
fi

# Verify the service file
echo "验证服务文件配置..."
# Check if ExecStart contains the node command (with shell wrapper)
if ! grep -q "ExecStart=.*$NODE_CMD.*$SERVER_SCRIPT" "$TEMP_SERVICE"; then
    echo "警告: ExecStart 可能未正确更新，检查服务文件..."
    grep "^ExecStart=" "$TEMP_SERVICE" || echo "未找到 ExecStart 行"
else
    echo "ExecStart 已正确配置:"
    grep "^ExecStart=" "$TEMP_SERVICE"
fi

# Display full service file for debugging
echo "完整的服务文件内容:"
cat "$TEMP_SERVICE"
echo "---"

# Copy to systemd directory
sudo cp "$TEMP_SERVICE" /etc/systemd/system/$SERVICE_NAME
sudo chmod 644 /etc/systemd/system/$SERVICE_NAME
rm -f "$TEMP_SERVICE"

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

# Test if the command can be executed as the service user before starting
echo "测试服务用户是否可以执行命令..."
DEPLOY_USER=$(whoami)
if sudo -u "$DEPLOY_USER" "$NODE_CMD" --version &> /dev/null; then
    echo "✓ 服务用户可以执行 Node.js"
else
    echo "✗ 警告: 服务用户无法执行 Node.js"
    echo "尝试以服务用户身份执行:"
    sudo -u "$DEPLOY_USER" "$NODE_CMD" --version || true
    echo "检查文件权限:"
    ls -l "$NODE_CMD" || true
fi

# Test if server.js can be accessed
if sudo -u "$DEPLOY_USER" test -f "$SERVER_SCRIPT"; then
    echo "✓ 服务用户可以访问 server.js"
else
    echo "✗ 警告: 服务用户无法访问 server.js"
    ls -l "$SERVER_SCRIPT" || true
fi

# Start the service
echo "启动服务..."
sudo systemctl start "$SERVICE_NAME"

# Wait a moment for the service to start
sleep 5

# Check service status
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "======================================"
    echo "部署成功！"
    echo "======================================"
    echo "服务状态:"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -20
    echo ""
    echo "查看日志: sudo journalctl -u $SERVICE_NAME -f"
    echo "重启服务: sudo systemctl restart $SERVICE_NAME"
    echo "服务地址: http://$(hostname -I | awk '{print $1}'):${PORT}"
else
    echo "======================================"
    echo "部署失败！服务未能启动"
    echo "======================================"
    echo "查看日志:"
    sudo journalctl -u "$SERVICE_NAME" --no-pager -l | tail -30
    exit 1
fi

# Clean up deployment directory
echo "清理临时文件..."
sudo rm -rf "$DEPLOY_DIR"

echo "部署完成！"

