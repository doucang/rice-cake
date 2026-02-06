const form = document.getElementById("orderForm");
const formSection = document.getElementById("formSection");
const successSection = document.getElementById("successSection");

if (form) {
  const qtyInput = form.querySelector("input[name='quantity']");
  const qtyButtons = form.querySelectorAll(".qty-btn");

  qtyButtons.forEach(button => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.step || 0);
      const current = Number(qtyInput.value || 1);
      const next = Math.max(1, current + step);
      qtyInput.value = String(next);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

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
