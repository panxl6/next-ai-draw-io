#!/bin/bash

# Next.js AI Draw.io Deployment Script
# This script deploys the Next.js application to the server

set -e  # Exit on error

APP_NAME="next-ai-draw-io"
DEPLOY_DIR="/tmp/deploy-next-ai-draw-io"
APP_DIR="/opt/${APP_NAME}"
BACKUP_DIR="/opt/${APP_NAME}-backup"
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
sudo mkdir -p "$BACKUP_DIR"

# Backup current deployment if it exists
if [ -d "$APP_DIR/.next" ] || [ -f "$APP_DIR/server.js" ]; then
    echo "备份当前部署..."
    sudo rm -rf "$BACKUP_DIR"/*
    sudo cp -r "$APP_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
    echo "备份完成"
fi

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

# Check if this is a standalone build
# Standalone mode can be in two forms:
# 1. .next/standalone/ directory (preserved structure)
# 2. .next/ directory with server.js (unpacked standalone)
if [ -f "$APP_DIR/.next/server.js" ]; then
    echo "检测到 standalone 构建模式（展开格式）"
    # Standalone content was unpacked to .next/
    cd "$APP_DIR/.next"
    
    # In standalone mode, public and static should be linked from parent directory
    # Create symlinks for public and .next/static if needed
    if [ -d "$APP_DIR/public" ] && [ ! -e "./public" ]; then
        ln -sf "$APP_DIR/public" ./public || true
    fi
    # Static files should be at .next/static (sibling to standalone content)
    # In unpacked mode, static is already at .next/static, so create symlink inside .next
    if [ -d "$APP_DIR/.next/static" ] && [ ! -d "./.next/static" ]; then
        mkdir -p .next
        ln -sf "$APP_DIR/.next/static" ./.next/static || true
    fi
    
    SERVER_SCRIPT="$APP_DIR/.next/server.js"
    echo "服务器脚本路径: $SERVER_SCRIPT"
elif [ -d "$APP_DIR/.next/standalone" ] && [ -f "$APP_DIR/.next/standalone/server.js" ]; then
    echo "检测到 standalone 构建模式（目录格式）"
    # For standalone mode, the server.js is in .next/standalone
    cd "$APP_DIR/.next/standalone"
    
    # Create symlinks for public and .next/static
    if [ -d "$APP_DIR/public" ]; then
        ln -sf "$APP_DIR/public" ./public || true
    fi
    if [ -d "$APP_DIR/.next/static" ]; then
        mkdir -p .next
        ln -sf "$APP_DIR/.next/static" ./.next/static || true
    fi
    
    # Update service file to use standalone server.js
    SERVER_SCRIPT="$APP_DIR/.next/standalone/server.js"
else
    # Standard build mode
    echo "使用标准构建模式"
    cd "$APP_DIR"
    
    # Install production dependencies (only production packages)
    # Skip prepare script to avoid husky installation error (husky is devDependency)
    echo "安装生产依赖..."
    npm ci --omit=dev --ignore-scripts
    
    # Use root server.js if exists, otherwise create one
    if [ ! -f "$APP_DIR/server.js" ]; then
        echo "创建 server.js..."
        cat > "$APP_DIR/server.js" << 'EOF'
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '6002', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true)
            await handle(req, res, parsedUrl)
        } catch (err) {
            console.error('Error occurred handling', req.url, err)
            res.statusCode = 500
            res.end('internal server error')
        }
    }).listen(port, hostname, (err) => {
        if (err) throw err
        console.log(`> Ready on http://${hostname}:${port}`)
    })
})
EOF
    fi
    
    SERVER_SCRIPT="$APP_DIR/server.js"
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
sed -i "s|^ExecStart=.*|ExecStart=$NODE_CMD $SERVER_SCRIPT|" "$TEMP_SERVICE"
sed -i "s|^WorkingDirectory=.*|WorkingDirectory=$SERVER_DIR|" "$TEMP_SERVICE"

# Update User to match deploy user if needed
DEPLOY_USER=$(whoami)
sed -i "s|^User=.*|User=$DEPLOY_USER|" "$TEMP_SERVICE"
sed -i "s|^Group=.*|Group=$DEPLOY_USER|" "$TEMP_SERVICE"

# Fix systemd security settings to allow Node.js execution
# ProtectSystem=strict blocks /usr (read-only mount), preventing execution of /usr/local/bin/node
NODE_DIR=$(dirname "$NODE_CMD")
echo "Node.js 目录: $NODE_DIR"
# If Node.js is in /usr/local/bin or /usr/bin, we need to adjust security settings
if [[ "$NODE_DIR" == "/usr/local/bin" ]] || [[ "$NODE_DIR" == "/usr/bin" ]]; then
    echo "调整 systemd 安全设置以允许执行 Node.js..."
    # Completely remove ProtectSystem to allow execution
    # This is necessary because ProtectSystem=strict/true can block execution
    sed -i "/^ProtectSystem=/d" "$TEMP_SERVICE"
    echo "已移除 ProtectSystem 限制"
    
    # Also ensure PATH is set for the service user
    if ! grep -q "^Environment=PATH=" "$TEMP_SERVICE"; then
        # Add PATH environment variable after existing Environment lines
        sed -i "/^Environment=.*/a Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$TEMP_SERVICE"
        echo "已添加 PATH 环境变量"
    fi
fi

# Verify the service file
echo "验证服务文件配置..."
if ! grep -q "^ExecStart=$NODE_CMD $SERVER_SCRIPT" "$TEMP_SERVICE"; then
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
    echo ""
    echo "尝试恢复备份..."
    if [ -d "$BACKUP_DIR/.next" ] || [ -f "$BACKUP_DIR/server.js" ]; then
        sudo rm -rf "$APP_DIR"/*
        sudo cp -r "$BACKUP_DIR"/* "$APP_DIR/" || true
        sudo systemctl start "$SERVICE_NAME" || true
    fi
    exit 1
fi

# Clean up deployment directory
echo "清理临时文件..."
sudo rm -rf "$DEPLOY_DIR"

echo "部署完成！"

