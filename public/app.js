function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function $(id) {
  return document.getElementById(id);
}

function formatItems(items) {
  if (!items?.length) return "-";
  return items.map(x => `${x.name}×${x.qty}`).join("，");
}

function formatMyr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "RM -";
  return `RM ${Math.round(n)}`;
}

function formatCny(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "¥ -";
  return `¥${n.toFixed(2)}`;
}

function roundTo(n, digits) {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const p = 10 ** digits;
  return Math.round(num * p) / p;
}

function isCnyPaymentMethod(method) {
  return method === "WECHAT_QR" || method === "ALIPAY_QR";
}

function paymentMethodLabel(method) {
  if (method === "WECHAT_QR") return "微信";
  if (method === "ALIPAY_QR") return "支付宝";
  if (method === "DUITNOW_QR") return "TNG";
  return method || "-";
}

function loadPayMethod() {
  return localStorage.getItem("ricecake.paymentMethod") || "";
}

function savePayMethod(method) {
  localStorage.setItem("ricecake.paymentMethod", String(method || ""));
}

function loadFxMyrCny() {
  try {
    const raw = localStorage.getItem("ricecake.fx.myr_cny");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveFxMyrCny(fx) {
  try {
    localStorage.setItem("ricecake.fx.myr_cny", JSON.stringify(fx));
  } catch {
    // ignore
  }
}

async function fetchFxMyrCny() {
  const cached = loadFxMyrCny();
  try {
    const res = await fetch("/api/fx/myr-cny");
    const data = await res.json();
    if (res.ok && data && Number(data.rate) > 0) {
      saveFxMyrCny(data);
      return data;
    }
  } catch {
    // ignore
  }
  return cached;
}

function computeCartFromUI() {
  const ricecakeQty = Number($("ricecakeQty")?.value || 0);
  const unitPrice = 30;
  const items = [];
  if (ricecakeQty > 0) {
    items.push({ sku: "ricecake", name: "古法年糕", unitPrice, qty: ricecakeQty, amount: ricecakeQty * unitPrice });
  }
  const total = items.reduce((sum, x) => sum + x.amount, 0);
  return { items, total };
}

function saveCheckout(checkout) {
  localStorage.setItem("ricecake.checkout", JSON.stringify(checkout));
}

function loadCheckout() {
  try {
    const raw = localStorage.getItem("ricecake.checkout");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveInfo(info) {
  localStorage.setItem("ricecake.info", JSON.stringify(info));
}

function loadInfo() {
  try {
    const raw = localStorage.getItem("ricecake.info");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveReceipt(receipt) {
  localStorage.setItem("ricecake.receipt", JSON.stringify(receipt));
}

function loadReceipt() {
  try {
    const raw = localStorage.getItem("ricecake.receipt");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function renderSummary(checkout) {
  const totalEl = $("totalAmount");
  const itemsEl = $("itemsSummary");
  if (totalEl) totalEl.textContent = formatMyr(checkout?.total ?? 0);
  if (itemsEl) itemsEl.textContent = formatItems(checkout?.items);
}

function setupQtyButtons() {
  const qtyButtons = document.querySelectorAll(".qty-btn");
  qtyButtons.forEach(button => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.step || 0);
      const targetId = button.dataset.target;
      if (!targetId) return;
      const input = $(targetId);
      if (!input) return;
      const current = Number(input.value || 0);
      input.value = String(clamp(current + step, 0, 999));
      const checkout = computeCartFromUI();
      renderSummary(checkout);
      // also update link state
      const toInfoBtn = $("toInfoBtn");
      if (toInfoBtn) {
        toInfoBtn.classList.toggle("disabled", !checkout.items.length);
        toInfoBtn.setAttribute("aria-disabled", String(!checkout.items.length));
      }
    });
  });

  const ricecakeQty = $("ricecakeQty");
  if (ricecakeQty) {
    ricecakeQty.addEventListener("change", () => {
      ricecakeQty.value = String(clamp(Number(ricecakeQty.value || 0), 0, 999));
      const checkout = computeCartFromUI();
      renderSummary(checkout);
    });
  }
}

// Page: order.html
(function initOrderPage() {
  const toInfoBtn = $("toInfoBtn");
  const qty = $("ricecakeQty");
  if (!toInfoBtn || !qty) return;

  setupQtyButtons();
  const checkout = computeCartFromUI();
  renderSummary(checkout);

  toInfoBtn.addEventListener("click", (e) => {
    const next = computeCartFromUI();
    if (!next.items.length) {
      e.preventDefault();
      alert("请至少选择 1 份年糕。");
      return;
    }
    saveCheckout(next);
  });
})();

// Page: info.html
(function initInfoPage() {
  const form = $("infoForm");
  if (!form) return;

  const checkout = loadCheckout();
  if (!checkout || !checkout.items?.length) {
    alert("请先选择品类并确认金额。");
    window.location.href = "/order.html";
    return;
  }
  renderSummary(checkout);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.pickupLocation || !data.pickupDate || !data.contact || !data.name) {
      alert("请完整填写自提地点、取货日期、WhatsApp 联系方式与称呼。");
      return;
    }
    saveInfo(data);
    window.location.href = "/pay.html";
  });
})();

// Page: pay.html
(function initPayPage() {
  const form = $("payForm");
  if (!form) return;

  const checkout = loadCheckout();
  const info = loadInfo();
  const paySubtitle = $("paySubtitle");
  const payQrImg = $("payQrImg");
  const payHint = $("payHint");
  const payablePrimary = $("payablePrimary");
  const payableSecondary = $("payableSecondary");
  const fxNote = $("fxNote");
  const paymentRefInput = $("paymentRefInput");
  const txnHelpImage = $("txnHelpImage");
  const txnHelpText = $("txnHelpText");

  if (!checkout || !checkout.items?.length) {
    alert("请先选择品类并确认金额。");
    window.location.href = "/order.html";
    return;
  }
  if (!info || !info.pickupLocation || !info.pickupDate || !info.contact || !info.name) {
    alert("请先填写预订信息。");
    window.location.href = "/info.html";
    return;
  }
  renderSummary(checkout);

  const methodInputs = Array.from(document.querySelectorAll("input[name='paymentMethod']"));
  const savedMethod = loadPayMethod();
  if (savedMethod && methodInputs.length) {
    const found = methodInputs.find(x => x.value === savedMethod);
    if (found) found.checked = true;
  }

  const paySection = $("paySection");
  const txnHelpBtn = $("txnHelpBtn");
  const txnHelpModal = $("txnHelpModal");
  const closeHelpBtn = $("closeHelpBtn");

  let fx = loadFxMyrCny();
  let computedCnyTotal = null;

  function currentMethod() {
    return methodInputs.find(x => x.checked)?.value || "DUITNOW_QR";
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.classList.toggle("hidden", Boolean(hidden));
  }

  function renderPayUI() {
    const method = currentMethod();
    savePayMethod(method);

    const totalMyr = Number(checkout?.total ?? 0);
    const canCny = isCnyPaymentMethod(method) && fx && Number(fx.rate) > 0;
    computedCnyTotal = canCny ? roundTo(totalMyr * Number(fx.rate), 2) : null;

    if (method === "WECHAT_QR") {
      if (payQrImg) {
        payQrImg.src = "/wechat-qr.jpg";
        payQrImg.alt = "微信收款码";
      }
      setText(paySubtitle, "推荐微信支付，扫码付款后填写交易编号提交");
      if (paymentRefInput) paymentRefInput.placeholder = "例如：微信账单详情的交易单号/订单号";
      setHidden(txnHelpImage, true);
      setText(txnHelpText, "在微信支付详情/账单中找到交易单号/订单号并复制填写；找不到也可填截图里的编号。");
    } else if (method === "ALIPAY_QR") {
      if (payQrImg) {
        payQrImg.src = "/alipay-qr.jpg";
        payQrImg.alt = "支付宝收款码";
      }
      setText(paySubtitle, "使用支付宝支付，扫码付款后填写交易编号提交");
      if (paymentRefInput) paymentRefInput.placeholder = "例如：支付宝账单详情的交易号/订单号";
      setHidden(txnHelpImage, true);
      setText(txnHelpText, "在支付宝账单详情中找到交易号/订单号并复制填写；找不到也可填截图里的编号。");
    } else {
      if (payQrImg) {
        payQrImg.src = "/tng-qr.jpg";
        payQrImg.alt = "TNG / DuitNow 收款码";
      }
      setText(paySubtitle, "使用 TNG / DuitNow QR 付款，付款后填写交易编号提交");
      if (paymentRefInput) paymentRefInput.placeholder = "例如：TNG 交易详情页的交易编号";
      setHidden(txnHelpImage, false);
      setText(txnHelpText, "在 TNG 交易详情页找到「交易编号」这一行，并复制填写。");
    }

    if (isCnyPaymentMethod(method)) {
      if (canCny) {
        setText(payablePrimary, formatCny(computedCnyTotal));
        setText(payableSecondary, `约 ${formatMyr(totalMyr)}`);
        const asOf = fx.asOf ? new Date(fx.asOf) : null;
        const asOfText = asOf && !Number.isNaN(asOf.getTime()) ? asOf.toLocaleString() : "";
        const srcText = fx.source ? `来源：${fx.source}` : "";
        setText(fxNote, `参考汇率：1 MYR ≈ ${Number(fx.rate).toFixed(4)} CNY${asOfText ? `（更新：${asOfText}）` : ""}${srcText ? ` · ${srcText}` : ""}`);
        setText(payHint, `请在 ${paymentMethodLabel(method)} 中输入金额 ${formatCny(computedCnyTotal)} 完成付款。付款后复制/填写交易编号提交。`);
      } else {
        setText(payablePrimary, "¥ -");
        setText(payableSecondary, `合计：${formatMyr(totalMyr)}（汇率加载失败）`);
        setText(fxNote, "暂时无法获取当日汇率，请稍后刷新重试。");
        setText(payHint, "请稍后刷新页面获取人民币参考金额。");
      }
    } else {
      setText(payablePrimary, formatMyr(totalMyr));
      setText(payableSecondary, "");
      setText(fxNote, "");
      setText(payHint, "请按上方金额完成付款。付款后，请从 TNG 交易记录中复制/填写交易编号。");
    }
  }

  function openHelp() {
    if (!txnHelpModal) return;
    txnHelpModal.classList.remove("hidden");
  }

  function closeHelp() {
    if (!txnHelpModal) return;
    txnHelpModal.classList.add("hidden");
  }

  if (txnHelpBtn && txnHelpModal) {
    txnHelpBtn.addEventListener("click", openHelp);
    if (closeHelpBtn) closeHelpBtn.addEventListener("click", closeHelp);
    txnHelpModal.addEventListener("click", (e) => {
      if (e.target === txnHelpModal) closeHelp();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeHelp();
    });
  }

  if (methodInputs.length) {
    methodInputs.forEach((input) => {
      input.addEventListener("change", renderPayUI);
    });
  }

  // Initial render (fx loads async, but we render immediately for responsiveness).
  renderPayUI();
  fetchFxMyrCny().then((data) => {
    if (data && Number(data.rate) > 0) {
      fx = data;
      renderPayUI();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const paymentRef = (data.paymentRef || "").trim();
    if (!paymentRef) {
      alert("请填写交易编号。");
      return;
    }

    const method = currentMethod();
    const payCurrency = isCnyPaymentMethod(method) ? "CNY" : "MYR";
    if (payCurrency === "CNY" && typeof computedCnyTotal !== "number") {
      alert("汇率尚未加载，暂时无法计算人民币金额。请稍后刷新页面重试。");
      return;
    }

    const payload = {
      channel: "H5_WHATSAPP",
      // from info
      pickupDate: info.pickupDate,
      pickupLocation: info.pickupLocation,
      contact: info.contact,
      name: info.name,
      notes: info.notes || "",
      // from cart
      items: checkout.items,
      total: checkout.total,
      quantity: checkout.items.reduce((s, x) => s + (Number(x.qty) || 0), 0),
      // payment
      paymentMethod: method,
      paymentCurrency: payCurrency,
      fxRateMyrToCny: payCurrency === "CNY" && fx && Number(fx.rate) > 0 ? Number(fx.rate) : undefined,
      totalCny: payCurrency === "CNY" && typeof computedCnyTotal === "number" ? computedCnyTotal : undefined,
      paymentRef
    };

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "提交中...";

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const out = await res.json();
      if (!res.ok) {
        alert(out.error || "提交失败，请稍后再试");
        return;
      }

      const orderId = out?.order?.id;

      // clear stored flow data
      localStorage.removeItem("ricecake.checkout");
      localStorage.removeItem("ricecake.info");
      localStorage.removeItem("ricecake.paymentMethod");

      saveReceipt({
        orderId: orderId || "",
        pickupDate: payload.pickupDate,
        pickupLocation: payload.pickupLocation,
        items: payload.items,
        total: payload.total,
        totalCny: payload.totalCny,
        fxRateMyrToCny: payload.fxRateMyrToCny,
        paymentMethod: payload.paymentMethod,
        paymentCurrency: payload.paymentCurrency,
        paymentRef,
        name: payload.name,
        contact: payload.contact
      });

      form.reset();
      if (paySection) paySection.classList.add("hidden");
      window.location.href = "/success.html";
    } catch {
      alert("网络异常，请稍后再试");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "提交预订（完成）";
    }
  });
})();

// Page: success.html
(function initSuccessPage() {
  const orderIdEl = $("successOrderId");
  if (!orderIdEl) return;

  const receipt = loadReceipt();
  const pickupEl = $("successPickup");
  const pickupDateEl = $("successPickupDate");
  const itemsEl = $("successItems");
  const totalEl = $("successTotal");

  if (!receipt || !receipt.orderId) {
    orderIdEl.textContent = "订单号：-";
    if (pickupEl) pickupEl.textContent = "自提地点：-";
    if (pickupDateEl) pickupDateEl.textContent = "取货日期：-";
    if (itemsEl) itemsEl.textContent = "预订内容：-";
    if (totalEl) totalEl.textContent = "金额：RM -";
    return;
  }

  orderIdEl.textContent = `订单号：${receipt.orderId}`;
  if (pickupEl) pickupEl.textContent = `自提地点：${receipt.pickupLocation || "-"}`;
  if (pickupDateEl) pickupDateEl.textContent = `取货日期：${receipt.pickupDate || "-"}`;
  if (itemsEl) itemsEl.textContent = `预订内容：${formatItems(receipt.items)}`;
  if (totalEl) {
    const method = receipt.paymentMethod || "";
    const currency = receipt.paymentCurrency || (isCnyPaymentMethod(method) ? "CNY" : "MYR");
    const myrText = formatMyr(receipt.total ?? "-");
    if (currency === "CNY" && typeof receipt.totalCny === "number") {
      totalEl.textContent = `金额：${formatCny(receipt.totalCny)}（约 ${myrText}）`;
    } else {
      totalEl.textContent = `金额：${myrText}`;
    }
  }

  const phone = "60199619968";
  const afterSalesLink = $("whatsappAfterSales");
  if (afterSalesLink) {
    const method = receipt.paymentMethod || "";
    const payMethodText = paymentMethodLabel(method);
    const currency = receipt.paymentCurrency || (isCnyPaymentMethod(method) ? "CNY" : "MYR");
    const amountLine = (currency === "CNY" && typeof receipt.totalCny === "number")
      ? `金额：${formatCny(receipt.totalCny)}（约 ${formatMyr(receipt.total ?? "-")}）`
      : `金额：${formatMyr(receipt.total ?? "-")}`;
    const msg = [
      "你好，我需要售后帮助：",
      `订单号：${receipt.orderId || "-"}`,
      `自提地点：${receipt.pickupLocation || "-"}`,
      `取货日期：${receipt.pickupDate || "-"}`,
      `预订内容：${formatItems(receipt.items)}`,
      `支付方式：${payMethodText}`,
      amountLine,
      `交易编号：${receipt.paymentRef || "-"}`,
      `称呼：${receipt.name || "-"}`,
    ].join("\n");
    afterSalesLink.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }
})();
