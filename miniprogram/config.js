// 先跑通小程序流程：默认使用本地模拟提交（不需要合法域名）。
// 等你把后端部署到 HTTPS 域名并在小程序后台配置了 request 合法域名后：
// - 把 USE_MOCK 改成 false
// - 把 API_BASE 改成你的域名
export const USE_MOCK = true;
export const API_BASE = "";

