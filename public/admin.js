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
      return `
        <div class="order-card">
          <div class="order-top">
            <strong>${order.name}</strong>
            <span>${order.quantity} 份</span>
          </div>
          <p>联系方式：${order.contact || "-"}</p>
          <p>取货日期/时间：${order.pickupDate || "-"}</p>
          <p>自提地点：${order.pickupLocation || "-"}</p>
          <p>备注：${order.notes || "-"}</p>
          <p class="meta">提交时间：${created}</p>
        </div>
      `;
    })
    .join("");
}

async function loadOrders() {
  const res = await fetch("/api/orders");
  const data = await res.json();
  renderSummary(data);
  renderOrders(data);
}

refreshBtn.addEventListener("click", loadOrders);
loadOrders();
