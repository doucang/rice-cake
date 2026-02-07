import { API_BASE, USE_MOCK } from "../config";
import { randomId } from "./id";

function requestJson({ url, method = "GET", data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: { "Content-Type": "application/json" },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data);
        reject(res.data || { error: `HTTP ${res.statusCode}` });
      },
      fail: reject
    });
  });
}

export async function createOrder(payload) {
  if (USE_MOCK) {
    return {
      ok: true,
      order: {
        id: randomId(),
        createdAt: new Date().toISOString(),
        status: "NEW",
        ...payload
      }
    };
  }

  const base = (API_BASE || "").replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE 未配置");
  return requestJson({
    url: `${base}/api/orders`,
    method: "POST",
    data: payload
  });
}

