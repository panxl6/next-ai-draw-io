# Ubuntu 服务器手动部署调试命令

## 1. 准备工作

```bash
# 切换到部署目录
cd /tmp/deploy-next-ai-draw-io

# 检查部署文件是否存在
ls -la

# 检查 Node.js 是否安装
node --version
which node

# 检查当前用户
whoami
```

## 2. 手动执行部署脚本

```bash
# 给脚本添加执行权限
chmod +x /tmp/deploy-next-ai-draw-io/deploy.sh

# 执行部署脚本（使用 sudo）
sudo /tmp/deploy-next-ai-draw-io/deploy.sh
```

## 3. 如果部署失败，检查服务状态

```bash
# 查看服务状态
sudo systemctl status next-ai-draw-io.service -l --no-pager

# 查看详细日志
sudo journalctl -u next-ai-draw-io.service -n 50 --no-pager

# 查看实时日志
sudo journalctl -u next-ai-draw-io.service -f
```

## 4. 检查服务文件配置

```bash
# 查看实际的服务文件
sudo cat /etc/systemd/system/next-ai-draw-io.service

# 检查服务文件语法
sudo systemd-analyze verify /etc/systemd/system/next-ai-draw-io.service

# 测试服务配置（不启动）
sudo systemctl daemon-reload
sudo systemd-analyze verify next-ai-draw-io.service
```

## 5. 手动测试 Node.js 执行

```bash
# 检查 Node.js 路径和权限
ls -l /usr/local/bin/node
ls -l /opt/next-ai-draw-io/server.js

# 以服务用户身份测试执行 Node.js
DEPLOY_USER=$(whoami)
sudo -u $DEPLOY_USER /usr/local/bin/node --version

# 测试执行 server.js
sudo -u $DEPLOY_USER /usr/local/bin/node /opt/next-ai-draw-io/server.js &
# 等待几秒后检查进程
ps aux | grep node
# 停止测试进程
pkill -f "node.*server.js"
```

## 6. 检查文件权限

```bash
# 检查应用目录权限
ls -la /opt/next-ai-draw-io/

# 检查 server.js 权限
ls -l /opt/next-ai-draw-io/server.js

# 检查 .next 目录权限
ls -la /opt/next-ai-draw-io/.next/ 2>/dev/null || echo ".next 目录不存在"

# 修复权限（如果需要）
sudo chown -R $(whoami):$(whoami) /opt/next-ai-draw-io
```

## 7. 手动测试 systemd 服务启动

```bash
# 停止服务（如果正在运行）
sudo systemctl stop next-ai-draw-io.service

# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 尝试启动服务
sudo systemctl start next-ai-draw-io.service

# 立即查看状态
sudo systemctl status next-ai-draw-io.service -l --no-pager

# 查看启动日志
sudo journalctl -u next-ai-draw-io.service -n 20 --no-pager
```

## 8. 调试 systemd 执行问题

```bash
# 查看 systemd 的详细执行信息
sudo systemctl status next-ai-draw-io.service -l --no-pager | grep -A 10 "Main process"

# 检查 systemd 安全设置
sudo cat /etc/systemd/system/next-ai-draw-io.service | grep -E "(Protect|Private|NoNew)"

# 尝试简化服务文件测试
# 创建一个测试服务文件
sudo tee /tmp/test-service.service > /dev/null <<EOF
[Unit]
Description=Test Service
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/opt/next-ai-draw-io
ExecStart=/usr/local/bin/node --version
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# 测试这个简化服务
sudo cp /tmp/test-service.service /etc/systemd/system/test-service.service
sudo systemctl daemon-reload
sudo systemctl start test-service.service
sudo systemctl status test-service.service
sudo systemctl stop test-service.service
sudo rm /etc/systemd/system/test-service.service
sudo systemctl daemon-reload
```

## 9. 检查环境变量和路径

```bash
# 检查服务用户的环境
DEPLOY_USER=$(whoami)
sudo -u $DEPLOY_USER env | grep PATH

# 检查 Node.js 是否在 PATH 中
sudo -u $DEPLOY_USER which node

# 检查工作目录
cd /opt/next-ai-draw-io && pwd
ls -la server.js
```

## 10. 完整的诊断脚本

```bash
#!/bin/bash
echo "=== 部署诊断信息 ==="
echo ""
echo "1. 当前用户: $(whoami)"
echo "2. Node.js 版本: $(node --version)"
echo "3. Node.js 路径: $(which node)"
echo "4. 服务状态:"
sudo systemctl status next-ai-draw-io.service --no-pager -l | head -20
echo ""
echo "5. 最新日志:"
sudo journalctl -u next-ai-draw-io.service -n 10 --no-pager
echo ""
echo "6. 服务文件内容:"
sudo cat /etc/systemd/system/next-ai-draw-io.service
echo ""
echo "7. 文件权限:"
ls -l /usr/local/bin/node
ls -l /opt/next-ai-draw-io/server.js 2>/dev/null || echo "server.js 不存在"
echo ""
echo "8. 测试 Node.js 执行:"
sudo -u $(whoami) /usr/local/bin/node --version
```

保存为 `diagnose.sh`，然后运行：
```bash
chmod +x diagnose.sh
./diagnose.sh
```

## 11. 常见问题排查

### 如果看到 203/EXEC 错误：

```bash
# 检查 Node.js 是否真的可执行
file /usr/local/bin/node
/usr/local/bin/node --version

# 检查是否是符号链接
ls -l /usr/local/bin/node

# 如果是符号链接，检查目标文件
readlink -f /usr/local/bin/node
ls -l $(readlink -f /usr/local/bin/node)
```

### 如果服务文件格式有问题：

```bash
# 验证服务文件语法
sudo systemd-analyze verify /etc/systemd/system/next-ai-draw-io.service

# 检查是否有特殊字符
sudo cat /etc/systemd/system/next-ai-draw-io.service | cat -A
```

### 如果需要完全重置：

```bash
# 停止服务
sudo systemctl stop next-ai-draw-io.service
sudo systemctl disable next-ai-draw-io.service

# 删除服务文件
sudo rm /etc/systemd/system/next-ai-draw-io.service
sudo systemctl daemon-reload

# 重新运行部署脚本
sudo /tmp/deploy-next-ai-draw-io/deploy.sh
```

## 12. 实时监控部署过程

```bash
# 在一个终端运行部署
sudo /tmp/deploy-next-ai-draw-io/deploy.sh

# 在另一个终端实时查看日志
sudo journalctl -u next-ai-draw-io.service -f
```

