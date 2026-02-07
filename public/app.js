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
  if (totalEl) totalEl.textContent = `RM ${checkout?.total ?? 0}`;
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

  const paySection = $("paySection");
  const txnHelpBtn = $("txnHelpBtn");
  const txnHelpModal = $("txnHelpModal");
  const closeHelpBtn = $("closeHelpBtn");

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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const paymentRef = (data.paymentRef || "").trim();
    if (!paymentRef) {
      alert("请填写交易编号。");
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
      paymentMethod: "DUITNOW_QR",
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

      saveReceipt({
        orderId: orderId || "",
        pickupDate: payload.pickupDate,
        pickupLocation: payload.pickupLocation,
        items: payload.items,
        total: payload.total,
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
  if (totalEl) totalEl.textContent = `金额：RM ${receipt.total ?? "-"}`;

  const phone = "60199619968";
  const afterSalesLink = $("whatsappAfterSales");
  if (afterSalesLink) {
    const msg = [
      "你好，我需要售后帮助：",
      `订单号：${receipt.orderId || "-"}`,
      `自提地点：${receipt.pickupLocation || "-"}`,
      `取货日期：${receipt.pickupDate || "-"}`,
      `预订内容：${formatItems(receipt.items)}`,
      `金额：RM ${receipt.total ?? "-"}`,
      `交易编号：${receipt.paymentRef || "-"}`,
      `称呼：${receipt.name || "-"}`,
    ].join("\n");
    afterSalesLink.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }
})();
