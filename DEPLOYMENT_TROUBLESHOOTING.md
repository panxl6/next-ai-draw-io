# 部署问题排查指南

## 常见问题

### 1. 无法访问服务 (https://43.128.81.143:6002)

#### 问题分析

**HTTPS 强制要求**：
- ⚠️ **生产环境必须使用 HTTPS**
- 应用在生产环境中会强制所有 HTTP 请求重定向到 HTTPS
- 必须配置 Nginx 反向代理来处理 HTTPS 请求
- 不能直接使用 HTTP 访问应用端口（6002）

#### 解决方案

**方案 A：使用 HTTP 访问（临时方案）**

1. 检查服务状态：
   ```bash
   sudo systemctl status next-ai-draw-io.service
   ```

2. 查看服务日志：
   ```bash
   sudo journalctl -u next-ai-draw-io.service -f
   ```

3. 确认服务监听的端口：
   ```bash
   sudo netstat -tlnp | grep node
   # 或
   sudo ss -tlnp | grep node
   ```

4. **不能直接访问应用端口**：
   - ⚠️ 应用在生产环境强制使用 HTTPS
   - 必须通过 Nginx 反向代理使用 HTTPS 访问
   - 直接访问 `http://43.128.81.143:6002` 会被重定向到 HTTPS

**方案 B：配置 HTTPS 和 Nginx 反向代理（推荐）**

1. 安装 Nginx：
   ```bash
   sudo apt update
   sudo apt install nginx -y
   ```

2. 配置 SSL 证书（使用 Let's Encrypt）：
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   # 如果有域名，使用域名配置
   sudo certbot --nginx -d your-domain.com
   ```

3. 创建 Nginx 配置文件：
   ```bash
   sudo nano /etc/nginx/sites-available/next-ai-draw-io
   ```

   添加以下配置（如果有域名）：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://127.0.0.1:6002;
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

   如果使用 IP 地址和自签名证书（不推荐，仅用于测试）：
   ```nginx
   server {
       listen 443 ssl;
       server_name 43.128.81.143;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://127.0.0.1:6002;
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
   
   server {
       listen 80;
       server_name 43.128.81.143;
       return 301 https://$server_name$request_uri;
   }
   ```

4. 启用配置：
   ```bash
   sudo ln -s /etc/nginx/sites-available/next-ai-draw-io /etc/nginx/sites-enabled/
   sudo nginx -t  # 测试配置
   sudo systemctl reload nginx
   ```

5. 配置防火墙：
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 6002/tcp  # 仅允许本地访问
   ```

**方案 C：修改服务端口为 6002**

如果确实需要使用 6002 端口，需要修改以下文件：

1. 修改 `next-ai-draw-io.service` 文件：
   ```ini
   Environment=PORT=6002
   ```

2. 修改 `deploy.sh` 文件：
   ```bash
   PORT=${PORT:-6002}
   ```

3. 重新部署

### 2. 服务无法启动

1. **检查服务状态**：
   ```bash
   sudo systemctl status next-ai-draw-io.service
   ```

2. **查看详细日志**：
   ```bash
   sudo journalctl -u next-ai-draw-io.service -n 100 --no-pager
   ```

3. **检查文件权限**：
   ```bash
   ls -la /opt/next-ai-draw-io/.next/standalone/
   sudo chown -R $USER:$USER /opt/next-ai-draw-io
   ```

4. **检查 Node.js 版本**：
   ```bash
   node --version  # 应该是 v18+ 或 v24+
   ```

5. **检查端口是否被占用**：
   ```bash
   sudo lsof -i :6002
   # 或
   sudo netstat -tlnp | grep 6002
   ```

### 3. 防火墙问题

检查防火墙规则：
```bash
sudo ufw status
```

开放端口（如果使用 6002）：
```bash
sudo ufw allow 6002/tcp
sudo ufw reload
```

如果使用 Nginx，只开放 80 和 443：
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 4. 快速诊断脚本

在服务器上运行以下脚本进行快速诊断：

```bash
#!/bin/bash
echo "=== 服务状态 ==="
sudo systemctl status next-ai-draw-io.service --no-pager -l | head -20

echo -e "\n=== 端口监听 ==="
sudo netstat -tlnp | grep 6002 || echo "端口未监听"

echo -e "\n=== 进程状态 ==="
ps aux | grep -E "node.*server.js" | grep -v grep || echo "进程未运行"

echo -e "\n=== 最新日志（最后20行） ==="
sudo journalctl -u next-ai-draw-io.service -n 20 --no-pager

echo -e "\n=== 文件检查 ==="
ls -la /opt/next-ai-draw-io/.next/standalone/server.js 2>/dev/null && echo "server.js 存在" || echo "server.js 不存在"

echo -e "\n=== 防火墙状态 ==="
sudo ufw status
```

保存为 `check-service.sh`，然后运行：
```bash
chmod +x check-service.sh
./check-service.sh
```

## 建议

1. **使用 Nginx 反向代理**：这是生产环境的最佳实践
2. **使用域名 + Let's Encrypt SSL**：提供安全的 HTTPS 访问
3. **监控服务状态**：定期检查服务日志
4. **配置自动重启**：service 文件已配置 `Restart=always`，服务崩溃会自动重启

