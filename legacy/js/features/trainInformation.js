// ===== ODPT 鉄道運行情報カード =====
// デスクトップでは左カラムに常時表示し、狭い画面ではツールバーのボタンから開く.
(() => {
  "use strict";

  const E = window.EkiHub;
  const card = document.getElementById("train-information");
  const content = document.getElementById("trainInfoContent");
  const updated = document.getElementById("trainInfoUpdated");
  const refreshButton = document.getElementById("trainInfoRefresh");
  const openButton = document.getElementById("trainInfoMobileTrigger");
  const closeButton = document.getElementById("trainInfoClose");
  const backdrop = document.getElementById("trainInfoBackdrop");
  const mobileQuery = window.matchMedia("(max-width: 880px)");

  if (!card || !content || !updated || !refreshButton || !openButton || !closeButton || !backdrop) {
    return;
  }

  let refreshTimer = null;
  let isFetching = false;
  let hasLoaded = false;
  let lastFocused = null;

  function escapeHtml(value) {
    if (E && typeof E.escapeHtml === "function") return E.escapeHtml(String(value ?? ""));
    const span = document.createElement("span");
    span.textContent = String(value ?? "");
    return span.innerHTML;
  }

  function formatTimestamp(value) {
    if (!value) return "更新時刻不明";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "更新時刻不明";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  }

  function scheduleRefresh(seconds) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    const safeSeconds = Math.min(300, Math.max(15, Number(seconds) || 60));
    refreshTimer = window.setTimeout(() => loadInformation({ preserveContent: true }), safeSeconds * 1000);
  }

  function renderLoading() {
    card.setAttribute("aria-busy", "true");
    refreshButton.disabled = true;
    content.innerHTML = `
      <div class="train-info-card__loading">
        <span class="train-info-card__spinner" aria-hidden="true"></span>
        最新情報を確認しています
      </div>`;
    updated.textContent = "更新時刻を確認中";
  }

  function renderError(message) {
    content.innerHTML = `
      <div class="train-info-card__state" role="status">
        <p>${escapeHtml(message)}</p>
        <button type="button" class="train-info-card__retry">もう一度読み込む</button>
      </div>`;
    const retryButton = content.querySelector(".train-info-card__retry");
    retryButton?.addEventListener("click", () => loadInformation());
    updated.textContent = "運行情報を更新できませんでした";
  }

  function renderInformation(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const stateOf = (item) =>
      item.serviceState || (item.isNormal ? "normal" : item.isServiceEnded ? "ended" : "alert");
    const alertCount = items.filter((item) => stateOf(item) === "alert").length;
    const endedCount = items.filter((item) => stateOf(item) === "ended").length;
    const normalCount = items.length - alertCount - endedCount;

    if (items.length === 0) {
      content.innerHTML = `
        <div class="train-info-card__state" role="status">
          <p>現在、表示できる鉄道運行情報はありません。</p>
        </div>`;
    } else {
      let summaryText = "掲載路線はすべて平常運転です";
      if (alertCount > 0) summaryText = `${alertCount}路線に遅延等の運行情報があります`;
      else if (endedCount === items.length) summaryText = "掲載路線は本日の運行を終了しています";
      else if (endedCount > 0) summaryText = "掲載路線に遅延等の情報はありません";

      const counts = [];
      if (normalCount > 0) counts.push(`平常 ${normalCount}`);
      if (endedCount > 0) counts.push(`運行終了 ${endedCount}`);
      if (alertCount > 0) counts.push(`情報あり ${alertCount}`);
      const summaryCount = counts.join(" / ");
      const listHtml = items
        .map((item) => {
          const serviceState = stateOf(item);
          const badge =
            serviceState === "normal"
              ? "平常運転"
              : serviceState === "ended"
                ? "本日の運行終了"
                : item.status || "運行情報あり";
          const stateClass =
            serviceState === "alert" ? " has-alert" : serviceState === "ended" ? " is-ended" : "";
          const itemUpdated = item.updatedAt
            ? `<time class="train-info-card__item-time" datetime="${escapeHtml(item.updatedAt)}">
                更新 ${escapeHtml(formatTimestamp(item.updatedAt))}
              </time>`
            : "";
          return `
            <li class="train-info-card__item${stateClass}">
              <div class="train-info-card__item-head">
                <span class="train-info-card__railway">${escapeHtml(item.railway)}</span>
                <span class="train-info-card__badge">${escapeHtml(badge)}</span>
              </div>
              <p class="train-info-card__text">${escapeHtml(item.text)}</p>
              ${itemUpdated}
            </li>`;
        })
        .join("");

      content.innerHTML = `
        <div class="train-info-card__summary${alertCount > 0 ? " has-alert" : endedCount > 0 ? " has-ended" : ""}">
          <span class="train-info-card__summary-main">${escapeHtml(summaryText)}</span>
          <span class="train-info-card__summary-count">${escapeHtml(summaryCount)}</span>
        </div>
        <ul class="train-info-card__list">${listHtml}</ul>`;
    }

    updated.textContent = `データ更新 ${formatTimestamp(data.updatedAt)}`;
  }

  async function loadInformation({ preserveContent = false } = {}) {
    if (isFetching) return;
    isFetching = true;
    if (!preserveContent || !hasLoaded) renderLoading();
    card.setAttribute("aria-busy", "true");
    refreshButton.disabled = true;

    try {
      const response = await fetch("/api/train-information", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      let data;
      try {
        data = await response.json();
      } catch (_parseError) {
        if (!response.ok) {
          throw new Error(
            `運行情報を取得できませんでした（HTTP ${response.status}）。時間をおいて更新してください。`
          );
        }
        throw new Error("運行情報の応答を読み取れませんでした。時間をおいて更新してください。");
      }
      if (!response.ok) {
        const apiMessage =
          data && typeof data.error === "string" && data.error.trim() ? data.error.trim() : null;
        throw new Error(
          apiMessage ||
            `運行情報を取得できませんでした（HTTP ${response.status}）。時間をおいて更新してください。`
        );
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("運行情報の応答形式を確認できませんでした。時間をおいて更新してください。");
      }
      renderInformation(data);
      hasLoaded = true;
      scheduleRefresh(data.refreshAfterSeconds);
    } catch (error) {
      if (!preserveContent || !hasLoaded) {
        renderError(error.message || "運行情報を取得できませんでした。");
      } else {
        updated.textContent = "自動更新に失敗しました。更新ボタンで再試行できます。";
      }
      scheduleRefresh(60);
    } finally {
      isFetching = false;
      card.removeAttribute("aria-busy");
      refreshButton.disabled = false;
    }
  }

  function openMobileCard() {
    if (!mobileQuery.matches) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    lastFocused = document.activeElement;
    card.classList.add("is-mobile-open");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    backdrop.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    openButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("train-info-is-open");
    card.focus({ preventScroll: true });
    if (!hasLoaded) loadInformation();
  }

  function closeMobileCard({ restoreFocus = true } = {}) {
    card.classList.remove("is-mobile-open");
    card.removeAttribute("role");
    card.removeAttribute("aria-modal");
    backdrop.classList.remove("is-open");
    backdrop.setAttribute("aria-hidden", "true");
    openButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("train-info-is-open");
    if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  openButton.addEventListener("click", openMobileCard);
  closeButton.addEventListener("click", () => closeMobileCard());
  backdrop.addEventListener("click", () => closeMobileCard());
  refreshButton.addEventListener("click", () => loadInformation());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && card.classList.contains("is-mobile-open")) {
      closeMobileCard();
    }
  });
  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) closeMobileCard({ restoreFocus: false });
  });

  loadInformation();
})();
