# 在 Ubuntu 上安装 Node.js 20

本文档提供了在 Ubuntu 服务器上安装 Node.js 20 的几种方法。

## 方法 1: 使用 NodeSource 官方仓库（推荐用于生产环境）

这是最稳定和推荐的方法，适合生产环境使用。

```bash
# 更新系统包列表
sudo apt update

# 安装必要的依赖
sudo apt install -y curl gnupg2 software-properties-common

# 添加 NodeSource 官方仓库（Node.js 20.x）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js 20
sudo apt install -y nodejs

# 验证安装
node --version
npm --version

# 应该显示 v20.x.x
```

**优点：**
- 官方维护，稳定可靠
- 安装到系统目录（`/usr/bin/node`），systemd 服务可以直接使用
- 自动更新支持

**缺点：**
- 需要 root 权限
- 全局安装，不能轻松切换版本

## 方法 2: 使用 NVM (Node Version Manager)（推荐用于开发环境）

NVM 允许你安装和管理多个 Node.js 版本，适合开发环境。

```bash
# 安装 NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重新加载 shell 配置
source ~/.bashrc
# 或者
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装 Node.js 20
nvm install 20

# 使用 Node.js 20
nvm use 20

# 设置为默认版本
nvm alias default 20

# 验证安装
node --version
npm --version
```

**创建系统级符号链接（用于 systemd 服务）：**

```bash
# 创建符号链接到系统目录
sudo ln -sf "$(which node)" /usr/local/bin/node
sudo ln -sf "$(which npm)" /usr/local/bin/npm

# 验证符号链接
ls -l /usr/local/bin/node
node --version
```

**优点：**
- 可以轻松切换多个 Node.js 版本
- 不需要 root 权限安装
- 适合开发环境

**缺点：**
- 默认安装在用户目录，systemd 服务需要特殊配置
- 需要创建符号链接才能被 systemd 使用

## 方法 3: 使用 Snap

```bash
# 安装 Node.js 20 via Snap
sudo snap install node --classic --channel=20

# 验证安装
node --version
npm --version
```

**优点：**
- 简单快速
- 自动更新

**缺点：**
- 可能不是最新版本
- 路径可能不同

## 方法 4: 使用二进制包（手动安装）

```bash
# 下载 Node.js 20 二进制包
cd /tmp
wget https://nodejs.org/dist/v20.19.6/node-v20.19.6-linux-x64.tar.xz

# 解压
tar -xf node-v20.19.6-linux-x64.tar.xz

# 移动到系统目录
sudo mv node-v20.19.6-linux-x64 /usr/local/nodejs

# 创建符号链接
sudo ln -sf /usr/local/nodejs/bin/node /usr/local/bin/node
sudo ln -sf /usr/local/nodejs/bin/npm /usr/local/bin/npm

# 验证安装
node --version
npm --version
```

## 推荐方案对比

### 生产环境（服务器部署）

**推荐：方法 1 (NodeSource)**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**原因：**
- 安装到系统目录，systemd 服务可以直接使用
- 不需要额外的安全配置
- 稳定可靠，官方维护

### 开发环境

**推荐：方法 2 (NVM)**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

**原因：**
- 可以轻松切换版本
- 不需要 root 权限
- 适合多项目开发

## 验证安装

无论使用哪种方法，安装后都应该验证：

```bash
# 检查 Node.js 版本
node --version
# 应该显示: v20.x.x

# 检查 npm 版本
npm --version

# 检查安装路径
which node
which npm

# 测试 Node.js 是否正常工作
node -e "console.log('Node.js is working!')"
```

## 卸载 Node.js

### 如果使用 NodeSource 安装：

```bash
sudo apt remove nodejs
sudo apt purge nodejs
sudo rm -rf /etc/apt/sources.list.d/nodesource.list
sudo apt update
```

### 如果使用 NVM 安装：

```bash
nvm uninstall 20
# 或者卸载 NVM
rm -rf ~/.nvm
# 然后从 ~/.bashrc 中删除 NVM 相关配置
```

### 如果使用 Snap 安装：

```bash
sudo snap remove node
```

## 常见问题

### 1. 权限问题

如果遇到权限问题，确保使用正确的用户：

```bash
# 检查当前用户
whoami

# 检查 Node.js 权限
ls -l $(which node)
```

### 2. PATH 问题

如果 `node` 命令找不到：

```bash
# 检查 PATH
echo $PATH

# 手动添加到 PATH（临时）
export PATH=$PATH:/usr/local/bin

# 永久添加到 PATH（添加到 ~/.bashrc）
echo 'export PATH=$PATH:/usr/local/bin' >> ~/.bashrc
source ~/.bashrc
```

### 3. 版本冲突

如果系统中有多个 Node.js 安装：

```bash
# 查看所有 node 可执行文件
which -a node

# 使用完整路径
/usr/bin/node --version
/usr/local/bin/node --version
~/.nvm/versions/node/v20.19.6/bin/node --version
```

## 针对 systemd 服务的特殊配置

如果使用 NVM 安装，需要确保 systemd 服务可以访问 Node.js：

### 选项 A: 创建系统级符号链接（推荐）

```bash
# 确保 NVM 已加载
source ~/.nvm/nvm.sh

# 创建符号链接
sudo ln -sf "$(which node)" /usr/local/bin/node
sudo ln -sf "$(which npm)" /usr/local/bin/npm

# 验证
ls -l /usr/local/bin/node
```

### 选项 B: 在服务文件中使用完整路径

编辑 systemd 服务文件，使用 Node.js 的完整路径：

```ini
ExecStart=/home/ubuntu/.nvm/versions/node/v20.19.6/bin/node /opt/next-ai-draw-io/server.js
```

并确保移除 `ProtectHome=true` 限制。

## 更新 Node.js

### NodeSource 方法：

```bash
sudo apt update
sudo apt upgrade nodejs
```

### NVM 方法：

```bash
nvm install 20 --reinstall-packages-from=20
nvm alias default 20
```

## 参考链接

- [Node.js 官方下载页面](https://nodejs.org/)
- [NodeSource 安装指南](https://github.com/nodesource/distributions)
- [NVM GitHub 仓库](https://github.com/nvm-sh/nvm)

