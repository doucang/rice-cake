import { CATALOG } from "../../data/catalog";
import { saveCheckout } from "../../utils/storage";

Page({
  data: {
    catalog: [],
    itemsText: "-",
    total: 0
  },

  onLoad() {
    const catalog = CATALOG.map(x => ({
      ...x,
      qty: x.enabled ? (Number(x.defaultQty) || 0) : 0
    }));
    this.applyCatalog(catalog);
  },

  computeCheckout(catalog) {
    const items = (catalog || [])
      .filter(x => x.enabled && (Number(x.qty) || 0) > 0)
      .map(x => {
        const qty = Number(x.qty) || 0;
        const unitPrice = Number(x.unitPrice) || 0;
        return {
          sku: x.sku,
          name: x.name,
          unitPrice,
          qty,
          amount: qty * unitPrice
        };
      });

    const total = items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const itemsText = items.length ? items.map(x => `${x.name}×${x.qty}`).join("，") : "-";
    return { items, total, itemsText };
  },

  applyCatalog(catalog) {
    const checkout = this.computeCheckout(catalog);
    this.setData({
      catalog,
      total: checkout.total,
      itemsText: checkout.itemsText
    });
    return checkout;
  },

  stepQty(e) {
    const sku = e.currentTarget?.dataset?.sku;
    const step = Number(e.currentTarget?.dataset?.step || 0);
    if (!sku || !step) return;

    const nextCatalog = (this.data.catalog || []).map(item => {
      if (!item.enabled || item.sku !== sku) return item;
      const current = Number(item.qty) || 0;
      const qty = Math.max(0, Math.min(999, current + step));
      return { ...item, qty };
    });
    this.applyCatalog(nextCatalog);
  },

  goNext() {
    const checkout = this.computeCheckout(this.data.catalog);
    if (!checkout.items.length) {
      wx.showToast({ title: "请至少选择 1 份", icon: "none" });
      return;
    }

    saveCheckout({ items: checkout.items, total: checkout.total });
    wx.navigateTo({ url: "/pages/info/info" });
  }
});
