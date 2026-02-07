const summaryEl = document.getElementById("summary");
const listEl = document.getElementById("orderList");
const refreshBtn = document.getElementById("refreshBtn");
const filterPickupDateEl = document.getElementById("filterPickupDate");
const clearDateBtn = document.getElementById("clearDateBtn");
const todayBtn = document.getElementById("todayBtn");
const selectAllEl = document.getElementById("selectAll");
const bulkStatusEl = document.getElementById("bulkStatus");
const bulkApplyBtn = document.getElementById("bulkApplyBtn");
const bulkCountEl = document.getElementById("bulkCount");

const FILTER_STORAGE_KEY = "ricecake.admin.pickupDateFilter";

let selectedIds = new Set();
let lastOrders = [];

function paymentMethodLabel(method) {
  if (method === "WECHAT_QR") return "微信";
  if (method === "ALIPAY_QR") return "支付宝";
  if (method === "DUITNOW_QR") return "TNG";
  return method || "-";
}

function formatAmount(order) {
  const myr = `RM ${order.total ?? "-"}`;
  if (order.paymentCurrency === "CNY" && typeof order.totalCny === "number") {
    return `¥${Number(order.totalCny).toFixed(2)}（约 ${myr}）`;
  }
  return myr;
}

function getLocalISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPickupDateFilter() {
  return String(filterPickupDateEl?.value || "").trim();
}

function setPickupDateFilter(value) {
  if (!filterPickupDateEl) return;
  filterPickupDateEl.value = value;
  localStorage.setItem(FILTER_STORAGE_KEY, value);
}

function renderSummary(data) {
  const pickupDate = getPickupDateFilter();
  const filterLabel = pickupDate ? `取货日期：${pickupDate}` : "取货日期：全部";
  summaryEl.innerHTML = `
    <p class="hint" style="margin-bottom: 10px;">筛选：${filterLabel}</p>
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
  lastOrders = Array.isArray(data?.orders) ? data.orders : [];

  if (!data.orders.length) {
    listEl.innerHTML = "<p class=\"hint\">还没有预订记录。</p>";
    return;
  }

  listEl.innerHTML = data.orders
    .map(order => {
      const created = new Date(order.createdAt).toLocaleString();
      const status = order.status || "NEW";
      const checked = selectedIds.has(order.id) ? "checked" : "";
      return `
        <div class="order-card">
          <div class="order-top">
            <div class="order-ident">
              <input class="row-select" type="checkbox" data-id="${order.id}" aria-label="选择订单 ${order.id}" ${checked} />
              <strong>${order.name}</strong>
            </div>
            <span>${order.quantity} 份</span>
          </div>
          <p>状态：${status}</p>
          <p>渠道：${order.channel || "-"}</p>
          <p>支付方式：${paymentMethodLabel(order.paymentMethod)}</p>
          <p class="meta">订单号：${order.id}</p>
          <p>联系方式：${order.contact || "-"}</p>
          <p>交易编号：${order.paymentRef || "-"}</p>
          <p>取货日期：${order.pickupDate || "-"}</p>
          <p>自提地点：${order.pickupLocation || "-"}</p>
          <p>金额：${formatAmount(order)}</p>
          <p>明细：${(order.items || []).map(x => `${x.name}×${x.qty}`).join("，") || "-"}</p>
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

function updateBulkUI() {
  const count = selectedIds.size;
  if (bulkCountEl) bulkCountEl.textContent = `已选 ${count}`;

  if (!selectAllEl) return;
  const visibleIds = lastOrders.map(o => String(o?.id || "")).filter(Boolean);
  if (!visibleIds.length) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
    return;
  }
  const selectedVisible = visibleIds.filter(id => selectedIds.has(id)).length;
  selectAllEl.checked = selectedVisible === visibleIds.length;
  selectAllEl.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
}

async function bulkSetStatus(ids, status) {
  const next = String(status || "").toUpperCase();
  if (!ids.length) {
    alert("请先选择要批量修改的订单。");
    return;
  }
  if (!next) {
    alert("请选择要修改到的状态。");
    return;
  }

  if (!confirm(`确定将 ${ids.length} 条订单批量设置为 ${next} 吗？`)) return;

  const res = await fetch("/api/orders/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status: next })
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

listEl.addEventListener("change", (e) => {
  const checkbox = e.target.closest("input.row-select");
  if (!checkbox) return;
  const id = String(checkbox.dataset.id || "");
  if (!id) return;

  if (checkbox.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkUI();
});

async function loadOrders() {
  selectedIds = new Set();
  lastOrders = [];
  if (selectAllEl) {
    selectAllEl.checked = false;
    selectAllEl.indeterminate = false;
  }
  if (bulkStatusEl) bulkStatusEl.value = "";
  updateBulkUI();

  const pickupDate = getPickupDateFilter();
  const qs = new URLSearchParams();
  if (pickupDate) qs.set("pickupDate", pickupDate);
  const url = `/api/orders${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url);
  const data = await res.json();
  renderSummary(data);
  renderOrders(data);
  updateBulkUI();
}

refreshBtn.addEventListener("click", loadOrders);

if (filterPickupDateEl) {
  const saved = localStorage.getItem(FILTER_STORAGE_KEY);
  filterPickupDateEl.value = saved === null ? getLocalISODate() : saved;
  filterPickupDateEl.addEventListener("change", () => {
    localStorage.setItem(FILTER_STORAGE_KEY, filterPickupDateEl.value);
    loadOrders();
  });
}

if (todayBtn) {
  todayBtn.addEventListener("click", () => {
    setPickupDateFilter(getLocalISODate());
    loadOrders();
  });
}

if (clearDateBtn) {
  clearDateBtn.addEventListener("click", () => {
    setPickupDateFilter("");
    loadOrders();
  });
}

if (selectAllEl) {
  selectAllEl.addEventListener("change", () => {
    const checked = selectAllEl.checked;
    selectedIds = new Set();
    listEl.querySelectorAll("input.row-select").forEach((el) => {
      el.checked = checked;
      const id = String(el.dataset.id || "");
      if (checked && id) selectedIds.add(id);
    });
    updateBulkUI();
  });
}

if (bulkApplyBtn) {
  bulkApplyBtn.addEventListener("click", () => {
    const ids = Array.from(selectedIds);
    const status = String(bulkStatusEl?.value || "");
    bulkSetStatus(ids, status);
  });
}

loadOrders();
