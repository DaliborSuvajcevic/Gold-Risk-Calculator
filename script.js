// ---- Config -----------------------------------------------------------
const API_KEY = "285f06d73df743969af771c25c170170"; // move this server-side before going live
const SYMBOL = "XAU/USD";
const REFRESH_INTERVAL_MS = 20000; // how often to auto-refresh the live price
const CONTRACT_SIZE = 100;   // 1 standard lot of gold = 100 troy oz
const PIP_SIZE = 0.01;       // 1 pip = $0.01 move in the gold price
const PIP_VALUE_PER_LOT = CONTRACT_SIZE * PIP_SIZE; // = $1.00 per pip, per standard lot

let direction = "long";
let livePrice = null;

// ---- Elements -----------------------------------------------------------
const el = (id) => document.getElementById(id);
const form = el("calculator");
const tickerDot = el("ticker-dot");
const tickerPrice = el("ticker-price");
const tickerTime = el("ticker-time");
const refreshBtn = el("refresh-btn");
const useLiveBtn = el("use-live-btn");
const directionGroup = el("direction");
const ledger = el("ledger");
const errorMsg = el("error-msg");

// ---- Live price -----------------------------------------------------------
async function fetchLivePrice() {
  tickerDot.className = "ticker__dot";
  refreshBtn.classList.add("is-spinning");

  try {
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(SYMBOL)}&apikey=${API_KEY}`
    );
    const data = await response.json();

    const price = parseFloat(data.price);
    if (!data.price || Number.isNaN(price)) {
      throw new Error(data.message || "No price returned");
    }

    livePrice = price;
    tickerPrice.textContent = `$${price.toFixed(2)}`;
    tickerDot.className = "ticker__dot is-live";
    tickerTime.textContent = `updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    useLiveBtn.disabled = false;
  } catch (err) {
    tickerDot.className = "ticker__dot is-error";
    tickerPrice.textContent = "unavailable";
    tickerTime.textContent = "";
    useLiveBtn.disabled = true;
    console.error("Live price fetch failed:", err);
  } finally {
    refreshBtn.classList.remove("is-spinning");
  }
}

refreshBtn.addEventListener("click", fetchLivePrice);
useLiveBtn.addEventListener("click", () => {
  if (livePrice !== null) {
    el("entry-price").value = livePrice.toFixed(2);
  }
});

// ---- Direction toggle -----------------------------------------------------------
directionGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".direction-toggle__btn");
  if (!btn) return;

  direction = btn.dataset.direction;
  directionGroup.querySelectorAll(".direction-toggle__btn").forEach((b) => {
    const active = b === btn;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-checked", String(active));
  });
});

// ---- Calculation -----------------------------------------------------------
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
  ledger.hidden = true;
}

function clearError() {
  errorMsg.hidden = true;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const accountSize = parseFloat(el("account-size").value);
  const riskPercent = parseFloat(el("risk-percent").value);
  const stopLossPips = parseFloat(el("stop-loss").value);
  const entryPrice = parseFloat(el("entry-price").value);

  if ([accountSize, riskPercent, stopLossPips, entryPrice].some((v) => Number.isNaN(v))) {
    showError("Please fill in every field with a valid number.");
    return;
  }
  if (accountSize <= 0 || riskPercent <= 0 || stopLossPips <= 0 || entryPrice <= 0) {
    showError("All values must be greater than zero.");
    return;
  }
  if (riskPercent > 100) {
    showError("Risk per trade can't exceed 100%.");
    return;
  }

  const riskAmount = accountSize * (riskPercent / 100);
  const lotSize = riskAmount / (stopLossPips * PIP_VALUE_PER_LOT);
  const units = lotSize * CONTRACT_SIZE;
  const priceMove = stopLossPips * PIP_SIZE;
  const slPrice = direction === "long" ? entryPrice - priceMove : entryPrice + priceMove;

  el("out-risk-amount").textContent = `$${riskAmount.toFixed(2)}`;
  el("out-sl-price").textContent = `$${slPrice.toFixed(2)}`;
  el("out-lot-size").textContent = `${lotSize.toFixed(2)} lots`;
  el("out-units").textContent = `${units.toFixed(2)} oz`;
  el("out-pip-value").textContent = `$${(PIP_VALUE_PER_LOT * lotSize).toFixed(2)}`;

  ledger.hidden = false;
});

// ---- Auto-refresh -----------------------------------------------------------
let refreshTimer = null;

function startAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(fetchLivePrice, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    fetchLivePrice(); // catch up immediately when the tab regains focus
    startAutoRefresh();
  }
});

// ---- Init -----------------------------------------------------------
fetchLivePrice();
startAutoRefresh();