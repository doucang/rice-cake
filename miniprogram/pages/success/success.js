import { loadReceipt } from "../../utils/storage";

function formatItems(items) {
  if (!items?.length) return "-";
  return items.map(x => `${x.name}×${x.qty}`).join("，");
}

Page({
  data: {
    orderId: "-",
    pickupLocation: "-",
    pickupDate: "-",
    itemsText: "-",
    total: "-",
    paymentRef: "-",
    name: "-",
    contact: "-",
    afterSalesPhone: "+60 199 619 968"
  },

  onShow() {
    const r = loadReceipt();
    if (!r || !r.orderId) return;
    this.setData({
      orderId: r.orderId,
      pickupLocation: r.pickupLocation || "-",
      pickupDate: r.pickupDate || "-",
      itemsText: formatItems(r.items),
      total: r.total ?? "-",
      paymentRef: r.paymentRef || "-",
      name: r.name || "-",
      contact: r.contact || "-"
    });
  },

  copyAfterSalesText() {
    const text = [
      "你好，我需要售后帮助：",
      `订单号：${this.data.orderId || "-"}`,
      `自提地点：${this.data.pickupLocation || "-"}`,
      `取货日期：${this.data.pickupDate || "-"}`,
      `预订内容：${this.data.itemsText || "-"}`,
      `金额：RM ${this.data.total ?? "-"}`,
      `交易编号：${this.data.paymentRef || "-"}`,
      `称呼：${this.data.name || "-"}`,
      `联系方式：${this.data.contact || "-"}`,
    ].join("\n");
    wx.setClipboardData({ data: text });
  },

  copyPhone() {
    wx.setClipboardData({ data: (this.data.afterSalesPhone || "").replace(/\s+/g, "") });
  },

  backHome() {
    wx.redirectTo({ url: "/pages/order/order" });
  }
});
