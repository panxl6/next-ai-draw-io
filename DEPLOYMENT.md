# 部署文档

本文档说明如何使用 GitHub Actions 将 Next.js AI Draw.io 应用部署到 Ubuntu 服务器。

## 前提条件

### 服务器要求

1. **操作系统**: Ubuntu 20.04+ 或 Debian 11+
2. **Node.js**: Node.js 18+ 或 24+ (已预装)
3. **npm**: npm 已随 Node.js 一起安装
4. **用户权限**: 具有 sudo 权限的用户账户
5. **网络**: 服务器可以通过 SSH 访问

### 服务器准备

1. **验证 Node.js 环境** (确保已安装):
   ```bash
   node --version  # 应该显示 v18.x.x 或 v24.x.x
   npm --version   # 应该显示版本号
   ```

2. **创建应用目录**:
   ```bash
   sudo mkdir -p /opt/next-ai-draw-io
   sudo chown -R $USER:$USER /opt/next-ai-draw-io
   ```

3. **配置防火墙** (可选):
   ```bash
   sudo ufw allow 6002/tcp  # 如果使用默认端口 6002
   ```

## GitHub Secrets 配置

在 GitHub 仓库中配置以下 Secrets（Settings → Secrets and variables → Actions）：

1. **SERVER_HOST**: 服务器 IP 地址或域名
   - 例如: `192.168.1.100` 或 `example.com`

2. **SERVER_USER**: SSH 用户名
   - 例如: `ubuntu` 或 `root`

3. **SSH_PRIVATE_KEY**: SSH 私钥内容
   - 生成 SSH 密钥对:
     ```bash
     ssh-keygen -t rsa -b 4096 -C "github-actions"
     ```
   - 将公钥添加到服务器:
     ```bash
     ssh-copy-id -i ~/.ssh/id_rsa.pub user@your-server
     ```
   - 将私钥内容（`~/.ssh/id_rsa`）复制到 GitHub Secrets

4. **SERVER_PORT** (可选): SSH 端口，默认为 22
   - 如果使用非标准端口，例如: `2222`

## 服务器环境变量配置

在服务器上创建生产环境配置文件：

```bash
sudo nano /opt/next-ai-draw-io/.env.local
```

添加必要的环境变量（参考 `env.example`）：

```env
NODE_ENV=production
PORT=6002
# 添加其他必要的环境变量
```

**注意**: 敏感信息（如 API 密钥）不应提交到 Git，应在服务器上直接配置。

## 部署流程

### 自动部署

1. **推送到 main 分支**: 
   - 推送到 `main` 分支会自动触发部署
   - 在 GitHub Actions 页面查看部署进度

2. **手动触发**:
   - 在 GitHub Actions 页面选择 "Deploy to Ubuntu Server" 工作流
   - 点击 "Run workflow" 按钮

### 部署步骤说明

GitHub Actions 工作流将执行以下步骤：

1. ✅ 检出代码
2. ✅ 设置 Node.js 环境
3. ✅ 安装依赖 (`npm ci`)
4. ✅ 构建应用 (`npm run build`)
5. ✅ 准备部署文件
6. ✅ 测试 SSH 连接
7. ✅ 通过 SCP 传输文件到服务器
8. ✅ 执行部署脚本

## 部署脚本功能

`deploy.sh` 脚本执行以下操作：

1. **备份当前部署**: 自动备份现有部署，便于回滚
2. **停止服务**: 停止正在运行的应用服务
3. **复制新文件**: 将构建产物复制到应用目录
4. **安装依赖**: 安装生产依赖（仅生产包）
5. **配置服务**: 安装并启用 systemd 服务
6. **启动服务**: 启动应用服务
7. **验证部署**: 检查服务状态，确保部署成功
8. **错误恢复**: 如果部署失败，自动恢复备份

## 服务管理

### 查看服务状态

```bash
sudo systemctl status next-ai-draw-io.service
```

### 查看日志

```bash
# 实时查看日志
sudo journalctl -u next-ai-draw-io.service -f

# 查看最近的日志
sudo journalctl -u next-ai-draw-io.service -n 100
```

### 重启服务

```bash
sudo systemctl restart next-ai-draw-io.service
```

### 停止服务

```bash
sudo systemctl stop next-ai-draw-io.service
```

### 禁用服务

```bash
sudo systemctl disable next-ai-draw-io.service
```

## 故障排查

### 部署失败

1. **检查 SSH 连接**:
   ```bash
   ssh -i ~/.ssh/your_key user@your-server
   ```

2. **检查服务器日志**:
   ```bash
   sudo journalctl -u next-ai-draw-io.service -n 50
   ```

3. **检查文件权限**:
   ```bash
   ls -la /opt/next-ai-draw-io
   ```

4. **手动运行部署脚本**:
   ```bash
   sudo /tmp/deploy-next-ai-draw-io/deploy.sh
   ```

### 服务无法启动

1. **检查端口占用**:
   ```bash
   sudo netstat -tlnp | grep 6002
   ```

3. **检查环境变量**:
   ```bash
   cat /opt/next-ai-draw-io/.env.local
   ```

### 回滚到之前的版本

如果部署失败，脚本会自动恢复备份。也可以手动恢复：

```bash
sudo systemctl stop next-ai-draw-io.service
sudo rm -rf /opt/next-ai-draw-io/*
sudo cp -r /opt/next-ai-draw-io-backup/* /opt/next-ai-draw-io/
sudo systemctl start next-ai-draw-io.service
```

## 安全建议

1. **使用非 root 用户**: 建议使用具有 sudo 权限的非 root 用户
2. **SSH 密钥安全**: 使用强密码保护 SSH 密钥
3. **防火墙配置**: 只开放必要的端口
4. **定期更新**: 保持系统更新（Node.js 由服务器管理员维护）
5. **日志监控**: 定期检查应用日志，监控异常情况
6. **备份策略**: 定期备份应用数据和配置

## 生产环境优化（必需）

**⚠️ 安全要求：生产环境必须使用 HTTPS**

应用在生产环境中会强制所有 HTTP 请求重定向到 HTTPS。您必须配置 HTTPS 反向代理（推荐使用 Nginx）。

1. **配置 Nginx 反向代理和 HTTPS**（必需）:
   ```nginx
   # HTTP to HTTPS redirect
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   # HTTPS server
   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       # SSL certificate configuration (使用 Let's Encrypt)
       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       
       # SSL configuration for security
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;

       location / {
           proxy_pass http://localhost:6002;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

2. **使用 Let's Encrypt 配置 SSL 证书**:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d your-domain.com
   ```

3. **配置防火墙**（只开放 HTTPS 端口）:
   ```bash
   sudo ufw allow 80/tcp   # 仅用于 Let's Encrypt 验证和重定向
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw allow 6002/tcp from 127.0.0.1  # 仅允许本地访问应用端口
   sudo ufw reload
   ```

3. **进程管理**: 使用 PM2 替代 systemd（可选）

4. **日志轮转**: 配置日志轮转以避免日志文件过大

5. **监控**: 配置应用监控和告警

## 文件结构

部署后的文件结构：

```
/opt/next-ai-draw-io/
├── .next/              # Next.js 构建输出
│   ├── standalone/     # Standalone 模式构建
│   └── static/         # 静态资源
├── public/             # 公共静态文件
├── node_modules/       # 生产依赖
├── package.json        # 依赖配置
├── next.config.ts      # Next.js 配置
├── server.js           # 服务器启动脚本
├── .env.local          # 环境变量配置
├── deploy.sh           # 部署脚本
└── next-ai-draw-io.service  # systemd 服务文件
```

## 支持

如有问题，请查看：
- [GitHub Issues](https://github.com/your-repo/next-ai-draw-io/issues)
- 部署日志: `sudo journalctl -u next-ai-draw-io.service -f`

