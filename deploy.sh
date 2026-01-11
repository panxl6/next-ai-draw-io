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

# Find Node.js executable
NODE_CMD=$(which node || echo "/usr/bin/node")

echo "======================================"
echo "开始部署 ${APP_NAME}"
echo "======================================"

# Check if deployment directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "错误: 部署目录不存在: $DEPLOY_DIR"
    exit 1
fi

# Display Node.js version (assumes Node.js is already installed)
if command -v node &> /dev/null; then
    echo "Node.js 版本: $(node --version)"
    echo "npm 版本: $(npm --version || echo '未安装')"
else
    echo "警告: 未找到 Node.js 命令，请确保 Node.js 已正确安装"
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

# Check if this is a standalone build (has standalone directory)
if [ -d "$APP_DIR/.next/standalone" ]; then
    echo "检测到 standalone 构建模式"
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
    echo "安装生产依赖..."
    npm ci --omit=dev --production
    
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

# Update service file with correct paths
echo "配置 systemd 服务..."
# Get the directory of the server script
SERVER_DIR=$(dirname "$SERVER_SCRIPT")
sudo sed -i "s|ExecStart=.*|ExecStart=$NODE_CMD $SERVER_SCRIPT|" "$APP_DIR/$SERVICE_NAME"
sudo sed -i "s|WorkingDirectory=.*|WorkingDirectory=$SERVER_DIR|" "$APP_DIR/$SERVICE_NAME"
# Update User to match deploy user if needed
DEPLOY_USER=$(whoami)
sudo sed -i "s|^User=.*|User=$DEPLOY_USER|" "$APP_DIR/$SERVICE_NAME"
sudo sed -i "s|^Group=.*|Group=$DEPLOY_USER|" "$APP_DIR/$SERVICE_NAME"

sudo cp "$APP_DIR/$SERVICE_NAME" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

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

