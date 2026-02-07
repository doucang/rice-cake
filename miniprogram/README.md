# 叶记古法手作（小程序）- 本地开发说明

## 1. 用微信开发者工具导入

- 打开微信开发者工具首页，点击 **Import**
- 目录选择：本目录 `miniprogram/`
- AppID：填你的小程序 AppID（`wxf56f6aa9eefa24e2`）
- 项目名称：随意（例如：叶记古法手作）

## 2. 运行

导入后点击 **编译**，默认进入 `pages/order/order`。

## 3. 后端联调（后续再做）

当前默认是 **本地模拟提交**（不需要配置合法域名），跑通流程用。

当你准备好后端 HTTPS 域名并在小程序后台配置好“request 合法域名”后：

- 编辑 `miniprogram/config.js`
  - 把 `USE_MOCK` 改成 `false`
  - 把 `API_BASE` 改成你的域名（例如：`https://order.example.com`）

