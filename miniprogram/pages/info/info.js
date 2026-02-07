import { loadCheckout, saveInfo } from "../../utils/storage";

function formatItems(items) {
  if (!items?.length) return "-";
  return items.map(x => `${x.name}×${x.qty}`).join("，");
}

Page({
  data: {
    pickupLocations: ["16 Sierra", "Nexus 学校"],
    pickupIndex: 0,
    pickupDate: "",
    contact: "",
    name: "",
    notes: "",
    itemsText: "-",
    total: 0
  },

  onShow() {
    const checkout = loadCheckout();
    if (!checkout || !checkout.items?.length) {
      wx.showToast({ title: "请先选择品类", icon: "none" });
      wx.redirectTo({ url: "/pages/order/order" });
      return;
    }

    this.setData({
      itemsText: formatItems(checkout.items),
      total: checkout.total ?? 0
    });
  },

  onPickupChange(e) {
    this.setData({ pickupIndex: Number(e.detail.value || 0) });
  },

  onDateChange(e) {
    this.setData({ pickupDate: e.detail.value || "" });
  },

  onContact(e) {
    this.setData({ contact: e.detail.value || "" });
  },

  onName(e) {
    this.setData({ name: e.detail.value || "" });
  },

  onNotes(e) {
    this.setData({ notes: e.detail.value || "" });
  },

  goNext() {
    const { pickupLocations, pickupIndex, pickupDate, contact, name, notes } = this.data;
    if (!pickupDate || !contact || !name) {
      wx.showToast({ title: "请填写日期/联系方式/称呼", icon: "none" });
      return;
    }

    saveInfo({
      pickupLocation: pickupLocations[pickupIndex],
      pickupDate,
      contact,
      name,
      notes
    });

    wx.navigateTo({ url: "/pages/pay/pay" });
  }
});
