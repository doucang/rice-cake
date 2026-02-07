const KEY_CHECKOUT = "ricecake.checkout";
const KEY_INFO = "ricecake.info";
const KEY_RECEIPT = "ricecake.receipt";

export function saveCheckout(checkout) {
  wx.setStorageSync(KEY_CHECKOUT, checkout);
}

export function loadCheckout() {
  return wx.getStorageSync(KEY_CHECKOUT) || null;
}

export function clearCheckout() {
  wx.removeStorageSync(KEY_CHECKOUT);
}

export function saveInfo(info) {
  wx.setStorageSync(KEY_INFO, info);
}

export function loadInfo() {
  return wx.getStorageSync(KEY_INFO) || null;
}

export function clearInfo() {
  wx.removeStorageSync(KEY_INFO);
}

export function saveReceipt(receipt) {
  wx.setStorageSync(KEY_RECEIPT, receipt);
}

export function loadReceipt() {
  return wx.getStorageSync(KEY_RECEIPT) || null;
}

