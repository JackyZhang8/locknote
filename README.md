# LockNote.app

一个简单、可靠、离线优先的桌面加密笔记软件。
 
A simple, reliable, offline-first encrypted note-taking desktop app.

 Official Website: https://locknote.app

 Author: LockNote.app <support@locknote.app>

 ![LockNote.app Screenshot](./screenshot/screen.png)
 
## 功能特性
 
- **加密存储** - 所有笔记内容使用 AES-256-GCM 加密，密钥由 Argon2id 派生
- **离线优先** - 数据存储在本地，无需网络连接
- **Markdown 编辑** - 支持 Markdown 语法，实时预览
- **标签管理** - 为笔记添加标签，方便分类和筛选
- **全文搜索** - 搜索标题、内容和标签
- **历史版本** - 自动保存历史版本，支持回滚
- **备份恢复** - 支持手动备份和恢复数据
 
## Features
 
- **Encrypted storage** - All note content is encrypted with AES-256-GCM; keys are derived via Argon2id
- **Offline-first** - Data is stored locally; no network connection required
- **Markdown editing** - Markdown support with live preview
- **Tag management** - Add tags for classification and filtering
- **Full-text search** - Search titles, content, and tags
- **History versions** - Automatic history snapshots with rollback
- **Backup & restore** - Manual backup and restore supported
 
## 技术栈
 
- **后端**: Go + Wails v2
- **前端**: React + TypeScript + TailwindCSS
- **数据库**: SQLite (元数据)
- **加密**: AES-256-GCM + Argon2id
 
## Tech Stack
 
- **Backend**: Go + Wails v2
- **Frontend**: React + TypeScript + TailwindCSS
- **Database**: SQLite (metadata)
- **Crypto**: AES-256-GCM + Argon2id
 
## 开发环境要求
 
- Go 1.21+
- Node.js 18+
- Wails CLI v2
 
## Development Requirements
 
- Go 1.21+
- Node.js 18+
- Wails CLI v2
 
## 安装 Wails CLI
 
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```
 
## Install Wails CLI
 
```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```
 
## 开发
 
```bash
# 安装前端依赖
cd frontend && npm install && cd ..
 
# 开发模式运行
wails dev
```
 
## Development
 
```bash
# Install frontend dependencies
cd frontend && npm install && cd ..
 
# Run in dev mode
wails dev
```
 
## 构建
 
```bash
# 构建生产版本
wails build
```

## Windows 下载与运行（重要）

从 GitHub Release 下载的 .zip/.exe 可能会被 Windows 标记为“来自互联网”(MOTW)，导致：

- 弹出“Windows 已保护你的电脑”(SmartScreen)
- 第一次启动较慢/卡住（安全扫描 + WebView2 初始化）

解决办法（任选其一）：

1) 推荐：先对 zip 解除锁定，再解压

- 右键 zip -> 属性 -> 勾选/点击“解除锁定(Unblock)” -> 应用

2) 或者：解压后对 exe 解除锁定

- 右键 exe -> 属性 -> “解除锁定(Unblock)” -> 应用

3) PowerShell（可选）：

```powershell
Unblock-File .\LockNote.exe
# 或对整个解压目录：
Get-ChildItem -Recurse | Unblock-File
```
 
## Build
 
```bash
# Build production bundle
wails build
```

## Windows Download & Run (Important)

The .zip/.exe downloaded from GitHub Releases may be marked as “from the Internet” (MOTW), which can cause:

- “Windows protected your PC” (SmartScreen)
- Slow or stuck first launch (security scan + WebView2 initialization)

Workarounds (choose one):

1) Recommended: Unblock the zip first, then extract

- Right click zip -> Properties -> Unblock -> Apply

2) Or: Unblock the exe after extraction

- Right click exe -> Properties -> Unblock -> Apply

3) PowerShell (optional):

```powershell
Unblock-File .\LockNote.exe
# Or unblock everything in the extracted folder:
Get-ChildItem -Recurse | Unblock-File
```
 
## 项目结构
 
```
locknote/
├── main.go                 # 应用入口
├── app.go                  # 应用核心逻辑
├── api.go                  # API 方法
├── internal/
│   ├── crypto/            # 加密模块
│   ├── database/          # SQLite 数据库
│   ├── notes/             # 笔记服务
│   ├── tags/              # 标签服务
│   └── backup/            # 备份服务
├── frontend/
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── store/         # Zustand 状态管理
│   │   └── wailsjs/       # Wails 绑定
│   └── ...
└── docs/
    └── 功能.md            # 需求文档
```
 
## Project Structure
 
```
locknote/
├── main.go                 # Entry
├── app.go                  # App core logic
├── api.go                  # API methods
├── internal/
│   ├── crypto/             # Crypto module
│   ├── database/           # SQLite database
│   ├── notes/              # Notes service
│   ├── tags/               # Tags service
│   └── backup/             # Backup service
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── store/          # Zustand state
│   │   └── wailsjs/        # Wails bindings
│   └── ...
└── docs/
    └── 功能.md             # Requirements
```
 
## 安全说明
 
- 主密钥仅在解锁后驻留内存
- 每篇笔记使用独立随机 nonce
- 密文文件采用原子写入
- 支持恢复密钥重置密码
 
## Security Notes
 
- Master key only resides in memory after unlocking
- Each note uses an independent random nonce
- Ciphertext files use atomic write
- Password reset supported via recovery key
 
## 版本
 
v1.0.2
 
## Version
 
v1.0.2

## License

MIT. See [LICENSE](./LICENSE).
