# Rice Cake 年糕预订系统

一个基于 `Node.js + Express` 的轻量预订系统，适合本地商家快速收集年糕预订信息，并在后台查看汇总数据。

## 功能概览

- 前台宣传页与预订入口（`/`、`/order.html`）
- 预订表单提交（称呼、联系方式、数量、取货日期、备注）
- 后台汇总与列表查看（`/admin.html`）
- 可选后台 Basic Auth（通过环境变量开启）
- 本地 JSON 存储（`data/orders.json`）

## 技术栈

- Node.js
- Express 4
- 原生 HTML / CSS / JavaScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run dev
```

默认端口为 `3000`，启动后访问：

- 前台首页：[http://localhost:3000](http://localhost:3000)
- 预订页面：[http://localhost:3000/order.html](http://localhost:3000/order.html)
- 后台页面：[http://localhost:3000/admin.html](http://localhost:3000/admin.html)

## 环境变量

可通过环境变量配置后台认证：

- `PORT`：服务端口（默认 `3000`）
- `ADMIN_USER`：后台用户名（默认 `admin`）
- `ADMIN_PASS`：后台密码（默认空）

说明：

- 当 `ADMIN_PASS` 为空时，后台接口和页面不做认证（方便本地开发）。
- 生产环境建议必须设置 `ADMIN_PASS`，避免客户信息暴露。

## 数据存储

- 订单数据文件：`data/orders.json`
- 服务启动或读写时会自动创建目录和文件（若不存在）

示例字段：

- `id`
- `createdAt`
- `name`
- `contact`
- `quantity`
- `pickupDate`
- `pickupLocation`
- `notes`

## API 说明

### `POST /api/orders`

提交预订，必填字段：

- `name`
- `contact`（或 `phone`）
- `quantity`
- `pickupDate`

### `GET /api/orders`

获取后台汇总和订单列表。若设置了 `ADMIN_PASS`，需通过 Basic Auth 访问。

## 发布版本（GitHub）

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes "Release notes"
```

你也可以在 GitHub 网页端进入 `Releases` 创建新版本说明。

## 一键部署到阿里云（本机执行）

仓库内置了一个脚本：本机 `git push` 后，自动 SSH 到服务器执行 `git pull --ff-only`，并重启 `systemd` 服务。

```bash
npm run deploy
```

提示：脚本默认要求本地工作区为干净状态（没有未提交改动/未跟踪文件），避免“以为部署了但其实没提交”。如需强行执行可加 `DEPLOY_ALLOW_DIRTY=1`。

### 查看当前线上版本与变更

```bash
npm run deploy:status
```

它会显示：

- 服务器当前 `git` 提交（短 hash + 提交信息）
- `git describe --tags` 解析出来的版本号（如果有打 tag）
- 如果存在 `.deploy-prev`，会列出从上一版到当前版的提交列表（相当于“这版和上一版有什么不一样”）

### 一键回退线上版本（Rollback）

默认回退到上一版（来自服务器端 `.deploy-prev`；如果没有该文件，则回退到 `HEAD^`）：

```bash
npm run deploy:rollback
```

回退到指定版本（tag / commit hash）：

```bash
npm run deploy:rollback -- v0.1.1
```

可选环境变量（默认值适配当前阿里云部署）：

- `DEPLOY_SSH_USER`（默认 `root`）
- `DEPLOY_SSH_HOST`（默认 `47.250.92.76`）
- `DEPLOY_DIR`（默认 `/opt/ricecake`）
- `DEPLOY_SERVICE`（默认 `ricecake.service`）
- `DEPLOY_APP_USER`（默认 `ricecake`，用于在服务器上执行 `git pull`）
- `DEPLOY_HEALTHCHECK_URL`（默认 `http://localhost:3000/`）
- `DEPLOY_RUN_NPM_CI`（默认 `0`；当你改了依赖时可设为 `1`）

示例（依赖有改动时）：

```bash
DEPLOY_RUN_NPM_CI=1 npm run deploy
```

示例（本地有未提交改动，但仍要部署已提交内容）：

```bash
DEPLOY_ALLOW_DIRTY=1 npm run deploy
```
