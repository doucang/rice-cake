const form = document.getElementById("orderForm");
const formSection = document.getElementById("formSection");
const successSection = document.getElementById("successSection");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getQtyInput(id) {
  return document.getElementById(id);
}

function computeCart() {
  // MVP: only rice cake is live
  const ricecakeQty = Number(getQtyInput("ricecakeQty")?.value || 0);
  const unitPrice = 30;
  const total = Math.max(0, ricecakeQty) * unitPrice;

  const items = [];
  if (ricecakeQty > 0) {
    items.push({ sku: "ricecake", name: "古法年糕", unitPrice, qty: ricecakeQty, amount: ricecakeQty * unitPrice });
  }

  return { items, total };
}

function renderCart() {
  const totalEl = document.getElementById("totalAmount");
  const itemsInput = document.getElementById("itemsInput");
  const totalInput = document.getElementById("totalInput");

  const { items, total } = computeCart();

  if (totalEl) totalEl.textContent = `RM ${total}`;
  if (itemsInput) itemsInput.value = JSON.stringify(items);
  if (totalInput) totalInput.value = String(total);
}

function setupQtyButtons() {
  const qtyButtons = document.querySelectorAll(".qty-btn");

  qtyButtons.forEach(button => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.step || 0);
      const targetId = button.dataset.target;
      if (!targetId) return;

      const input = getQtyInput(targetId);
      if (!input) return;

      const current = Number(input.value || 0);
      const next = clamp(current + step, 0, 999);
      input.value = String(next);
      renderCart();
    });
  });

  const ricecakeQty = getQtyInput("ricecakeQty");
  if (ricecakeQty) {
    ricecakeQty.addEventListener("change", () => {
      const current = Number(ricecakeQty.value || 0);
      ricecakeQty.value = String(clamp(current, 0, 999));
      renderCart();
    });
  }
}

if (form) {
  setupQtyButtons();
  renderCart();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Basic validation: must have at least 1 item
    const { items, total } = computeCart();
    if (!items.length) {
      alert("请至少选择 1 份年糕再提交。");
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Normalize quantity from cart
    payload.quantity = items.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
    payload.items = items;
    payload.total = total;

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "提交中...";

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "提交失败，请稍后再试");
        return;
      }

      form.reset();
      // reset qty to 1 for next visitor
      const ricecakeQty = getQtyInput("ricecakeQty");
      if (ricecakeQty) ricecakeQty.value = "1";
      renderCart();

      if (formSection && successSection) {
        formSection.classList.add("hidden");
        successSection.classList.remove("hidden");
        successSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      alert("网络异常，请稍后再试");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "提交预订信息";
    }
  });
}
