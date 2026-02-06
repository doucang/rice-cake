const summaryEl = document.getElementById("summary");
const listEl = document.getElementById("orderList");
const refreshBtn = document.getElementById("refreshBtn");

function renderSummary(data) {
  summaryEl.innerHTML = `
    <div class="summary-grid">
      <div>
        <p class="label">总预订人数</p>
        <p class="value">${data.total}</p>
      </div>
      <div>
        <p class="label">总份数</p>
        <p class="value">${data.totalQuantity}</p>
      </div>
    </div>
  `;
}

function renderOrders(data) {
  if (!data.orders.length) {
    listEl.innerHTML = "<p class=\"hint\">还没有预订记录。</p>";
    return;
  }

  listEl.innerHTML = data.orders
    .map(order => {
      const created = new Date(order.createdAt).toLocaleString();
      const status = order.status || "NEW";
      return `
        <div class="order-card">
          <div class="order-top">
            <strong>${order.name}</strong>
            <span>${order.quantity} 份</span>
          </div>
          <p>状态：${status}</p>
          <p>联系方式：${order.contact || "-"}</p>
          <p>付款参考号：${order.paymentRef || "-"}</p>
          <p>取货日期：${order.pickupDate || "-"}</p>
          <p>自提地点：${order.pickupLocation || "-"}</p>
          <p>备注：${order.notes || "-"}</p>
          <div class="admin-actions">
            <button class="ghost" data-action="paid" data-id="${order.id}">标记已收款</button>
            <button class="ghost" data-action="done" data-id="${order.id}">标记完成</button>
          </div>
          <p class="meta">提交时间：${created}</p>
        </div>
      `;
    })
    .join("");
}

async function setStatus(id, status) {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "更新失败");
    return;
  }
  await loadOrders();
}

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;

  if (action === "paid") return setStatus(id, "PAID");
  if (action === "done") return setStatus(id, "FULFILLED");
});

async function loadOrders() {
  const res = await fetch("/api/orders");
  const data = await res.json();
  renderSummary(data);
  renderOrders(data);
}

refreshBtn.addEventListener("click", loadOrders);
loadOrders();
