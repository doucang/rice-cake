import { createOrder } from "../../utils/api";
import { loadCheckout, loadInfo, clearCheckout, clearInfo, saveReceipt } from "../../utils/storage";

function formatItems(items) {
  if (!items?.length) return "-";
  return items.map(x => `${x.name}×${x.qty}`).join("，");
}

Page({
  data: {
    itemsText: "-",
    total: 0,
    paymentRef: "",
    submitting: false
  },

  onShow() {
    const checkout = loadCheckout();
    const info = loadInfo();
    if (!checkout || !checkout.items?.length) {
      wx.showToast({ title: "请先选择品类", icon: "none" });
      wx.redirectTo({ url: "/pages/order/order" });
      return;
    }
    if (!info || !info.pickupLocation || !info.pickupDate || !info.contact || !info.name) {
      wx.showToast({ title: "请先填写信息", icon: "none" });
      wx.redirectTo({ url: "/pages/info/info" });
      return;
    }

    this.setData({
      itemsText: formatItems(checkout.items),
      total: checkout.total,
      paymentRef: ""
    });
  },

  previewQr() {
    wx.previewImage({ urls: ["/assets/tng-qr.jpg"] });
  },

  onPaymentRef(e) {
    this.setData({ paymentRef: e.detail.value || "" });
  },

  showTxnHelp() {
    wx.showModal({
      title: "如何找到交易编号？",
      content: "付款成功后，在支付 App 的交易记录里打开该笔交易详情，找到“交易编号/参考号/Reference No.”并复制填写。",
      showCancel: false
    });
  },

  async submit() {
    const checkout = loadCheckout();
    const info = loadInfo();
    if (!checkout || !checkout.items?.length || !info) return;

    const paymentRef = (this.data.paymentRef || "").trim();
    if (!paymentRef) {
      wx.showToast({ title: "请填写交易编号", icon: "none" });
      return;
    }

    const payload = {
      channel: "MP_WECHAT",
      pickupDate: info.pickupDate,
      pickupLocation: info.pickupLocation,
      contact: info.contact,
      name: info.name,
      notes: info.notes || "",
      items: checkout.items,
      total: checkout.total,
      quantity: checkout.items.reduce((s, x) => s + (Number(x.qty) || 0), 0),
      paymentMethod: "DUITNOW_QR",
      paymentRef
    };

    this.setData({ submitting: true });
    try {
      const out = await createOrder(payload);
      const orderId = out?.order?.id || "";

      clearCheckout();
      clearInfo();
      saveReceipt({
        orderId,
        pickupDate: payload.pickupDate,
        pickupLocation: payload.pickupLocation,
        items: payload.items,
        total: payload.total,
        paymentRef,
        name: payload.name,
        contact: payload.contact
      });

      wx.redirectTo({ url: "/pages/success/success" });
    } catch (e) {
      const msg = (e && (e.error || e.message)) ? (e.error || e.message) : "提交失败";
      wx.showToast({ title: msg, icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
