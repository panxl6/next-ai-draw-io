# 服务器 Node.js 安装配置指南

本指南说明如何在 Ubuntu 服务器上使用 nvm 安装 Node.js 并设置为全局可用。

## 安装 nvm

1. **下载并安装 nvm**：
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```

2. **重新加载 shell 配置**：
   ```bash
   source ~/.bashrc
   # 或者
   source ~/.profile
   ```

3. **验证 nvm 安装**：
   ```bash
   nvm --version
   ```

## 安装 Node.js

1. **安装 Node.js LTS 版本（推荐）**：
   ```bash
   nvm install 20
   # 或安装最新版本
   nvm install node
   ```

2. **验证 Node.js 安装**：
   ```bash
   node --version
   npm --version
   ```

## 设置为全局可用（系统级）

默认情况下，nvm 安装的 Node.js 只在当前用户环境下可用。要让系统服务（如 systemd）也能使用，需要创建符号链接：

### 方法 1：创建符号链接到系统路径（推荐）

```bash
# 1. 确保已安装并激活 Node.js
nvm use 20  # 或使用您安装的版本号

# 2. 找到 nvm 安装的 Node.js 路径
NVM_NODE=$(nvm which node)
NVM_DIR=$(dirname "$NVM_NODE")
NVM_NPM="$NVM_DIR/npm"

# 3. 创建符号链接到 /usr/local/bin（需要 sudo 权限）
sudo ln -sf "$NVM_NODE" /usr/local/bin/node
sudo ln -sf "$NVM_NPM" /usr/local/bin/npm

# 4. 验证系统路径中是否可用
which node
which npm
/usr/local/bin/node --version
/usr/local/bin/npm --version
```

### 方法 2：使用 nvm 的别名（每次登录后设置）

如果您使用 systemd 服务，需要在系统级别可用，建议使用方法 1。

如果只是临时使用，可以设置默认版本：

```bash
# 设置默认 Node.js 版本
nvm alias default 20

# 验证
nvm use default
node --version
```

### 方法 3：在系统 PATH 中添加 nvm 路径

编辑 `/etc/environment` 或创建系统级配置文件：

```bash
# 编辑系统环境变量（需要 sudo）
sudo nano /etc/environment

# 添加以下内容（根据实际 nvm 安装路径调整）
PATH="/home/your-username/.nvm/versions/node/v20.x.x/bin:$PATH"
```

然后重启系统或重新加载环境变量。

## 自动设置脚本

创建一个脚本来自动设置符号链接：

```bash
#!/bin/bash
# 文件名：setup-nodejs-global.sh

# 加载 nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 获取 Node.js 和 npm 的路径
NVM_NODE=$(nvm which node)
NVM_DIR=$(dirname "$NVM_NODE")
NVM_NPM="$NVM_DIR/npm"

# 创建符号链接
sudo ln -sf "$NVM_NODE" /usr/local/bin/node
sudo ln -sf "$NVM_NPM" /usr/local/bin/npm

# 验证
echo "Node.js 版本: $(/usr/local/bin/node --version)"
echo "npm 版本: $(/usr/local/bin/npm --version)"
echo ""
echo "Node.js 路径: $(which node)"
echo "npm 路径: $(which npm)"
```

保存后执行：

```bash
chmod +x setup-nodejs-global.sh
./setup-nodejs-global.sh
```

## 验证安装

1. **检查 Node.js 版本**：
   ```bash
   node --version  # 应该显示 v20.x.x 或更高
   npm --version
   ```

2. **检查系统路径**：
   ```bash
   which node
   which npm
   # 应该显示 /usr/local/bin/node 和 /usr/local/bin/npm
   ```

3. **测试 systemd 服务能否使用**（以 root 或 systemd 用户身份）：
   ```bash
   sudo -u www-data node --version
   # 或
   sudo node --version
   ```

## 注意事项

1. **版本兼容性**：
   - 项目需要 Node.js 20+ 或 24+
   - 服务器当前使用的是 v18.19.1，需要升级

2. **升级 Node.js**：
   ```bash
   # 使用 nvm 安装新版本
   nvm install 20
   nvm use 20
   nvm alias default 20
   
   # 更新符号链接
   NVM_NODE=$(nvm which node)
   NVM_DIR=$(dirname "$NVM_NODE")
   NVM_NPM="$NVM_DIR/npm"
   sudo ln -sf "$NVM_NODE" /usr/local/bin/node
   sudo ln -sf "$NVM_NPM" /usr/local/bin/npm
   ```

3. **systemd 服务配置**：
   确保 systemd 服务文件中使用的 Node.js 路径正确：
   ```ini
   ExecStart=/usr/local/bin/node /opt/next-ai-draw-io/.next/standalone/server.js
   ```

4. **权限问题**：
   确保部署用户有权限执行 Node.js：
   ```bash
   ls -l /usr/local/bin/node
   # 应该显示所有用户可执行
   ```

## 故障排查

如果 systemd 服务无法找到 Node.js：

1. **检查符号链接**：
   ```bash
   ls -l /usr/local/bin/node
   ls -l /usr/local/bin/npm
   ```

2. **检查 systemd 使用的路径**：
   ```bash
   sudo systemctl status next-ai-draw-io.service
   # 查看日志中的错误信息
   ```

3. **测试服务用户环境**：
   ```bash
   sudo -u www-data env | grep PATH
   sudo -u www-data which node
   ```

4. **如果仍然无法找到，在服务文件中使用完整路径**：
   编辑 `/etc/systemd/system/next-ai-draw-io.service`：
   ```ini
   ExecStart=/usr/local/bin/node /opt/next-ai-draw-io/.next/standalone/server.js
   ```

