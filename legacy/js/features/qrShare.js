// 機能モジュール: 共有URLのQRコード表示
// #hero-actions に「QR」ボタンを追加し, クリックでモーダルに共有URLのQRを表示する.
// QR生成は window.QRCode(qrcodejs)を使用. 未ロード時はフォールバック表示する.
(() => {
  "use strict";

  // EkiHubコアが存在しなければ何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 機能固有のスタイルを一度だけ注入
  E.injectStyle(
    "qrshare-style",
    `
    .qrshare-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
    }
    .qrshare-modal {
      background: #ffffff;
      color: #1a1a1a;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      max-width: 360px;
      width: 100%;
      padding: 20px;
      position: relative;
      box-sizing: border-box;
    }
    .qrshare-modal__title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0 0 14px;
      padding-right: 28px;
    }
    .qrshare-modal__close {
      position: absolute;
      top: 10px;
      right: 12px;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      font-size: 1.3rem;
      line-height: 1;
      cursor: pointer;
      color: #555;
      border-radius: 6px;
    }
    .qrshare-modal__close:hover {
      background: rgba(0, 0, 0, 0.08);
    }
    .qrshare-modal__qr {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 160px;
      margin: 0 auto 14px;
    }
    .qrshare-modal__qr img,
    .qrshare-modal__qr canvas {
      max-width: 100%;
      height: auto;
    }
    .qrshare-modal__note {
      font-size: 0.85rem;
      color: #c0392b;
      margin: 0 0 8px;
      text-align: center;
    }
    .qrshare-modal__url {
      font-size: 0.78rem;
      color: #333;
      word-break: break-all;
      background: #f4f4f6;
      border-radius: 6px;
      padding: 8px 10px;
      margin: 0;
    }
  `
  );

  // ------------------------------------------------------------------
  // 共有URLの自前生成(shareLinkと同じ規則だが依存しない小関数)
  //   ?o=駅名,…  &mode=A/B  &w=0-100  &fw=0-100
  //   &names=ラベル,…  &people=人数,…  &t=集合時刻
  // ------------------------------------------------------------------
  function buildShareUrl() {
    try {
      // 入力行を取得(name/label/people)
      const rows = (typeof E.getInputs === "function" ? E.getInputs() : []) || [];
      const names = rows.map((r) => (r && r.name ? String(r.name).trim() : "")).filter(Boolean);

      const base = location.origin + location.pathname;
      // 駅が無ければ現状URLのベースのみ返す
      if (names.length === 0) return base;

      const params = new URLSearchParams();
      params.set("o", names.join(","));

      // ラベル・人数は駅と同順で付与
      const valid = rows.filter((r) => r && r.name && String(r.name).trim());
      const labels = valid.map((r) => (r.label ? String(r.label).trim() : ""));
      const peoples = valid.map((r) => String(parseInt(r.people, 10) || 1));
      if (labels.some((s) => s)) params.set("names", labels.join(","));
      params.set("people", peoples.join(","));

      // 状態(モード・重み・集合時刻)を反映
      const state = (typeof E.getState === "function" ? E.getState() : {}) || {};
      if (state.currentMode === "A" || state.currentMode === "B") {
        params.set("mode", state.currentMode);
      }
      const w = Math.round((Number(state.fairnessWeight) || 0) * 100);
      params.set("w", String(Math.min(100, Math.max(0, w))));
      const fw = Math.round((Number(state.fareWeight) || 0) * 100);
      params.set("fw", String(Math.min(100, Math.max(0, fw))));
      const meeting = state.meetingTime || (typeof E.getMeetingTime === "function" ? E.getMeetingTime() : null);
      if (meeting) params.set("t", String(meeting));

      return base + "?" + params.toString();
    } catch (err) {
      // 生成失敗時は素のURLを返す
      console.error("[qrShare] URL生成に失敗しました", err);
      return location.href;
    }
  }

  // ------------------------------------------------------------------
  // モーダルの生成・表示
  // ------------------------------------------------------------------
  let overlayEl = null; // オーバーレイ要素(使い回し)
  let qrBoxEl = null; // QR描画先
  let urlEl = null; // URLテキスト表示先
  let noteEl = null; // 注記表示先(ライブラリ未読込など)

  // モーダルの骨組みを一度だけ作る
  function ensureModal() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.className = "qrshare-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.style.display = "none";

    const modal = document.createElement("div");
    modal.className = "qrshare-modal";

    const title = document.createElement("h2");
    title.className = "qrshare-modal__title";
    title.textContent = E.t ? E.t("qrshare.title", "共有用QRコード") : "共有用QRコード";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "qrshare-modal__close";
    closeBtn.setAttribute("aria-label", "閉じる");
    closeBtn.textContent = "×";

    qrBoxEl = document.createElement("div");
    qrBoxEl.className = "qrshare-modal__qr";

    noteEl = document.createElement("p");
    noteEl.className = "qrshare-modal__note";
    noteEl.style.display = "none";

    urlEl = document.createElement("p");
    urlEl.className = "qrshare-modal__url";

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(qrBoxEl);
    modal.appendChild(noteEl);
    modal.appendChild(urlEl);
    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);

    // 背景クリックで閉じる(モーダル本体クリックは無視)
    overlayEl.addEventListener("click", (ev) => {
      if (ev.target === overlayEl) closeModal();
    });
    // ×ボタンで閉じる
    closeBtn.addEventListener("click", closeModal);
    // Escキーで閉じる
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && overlayEl && overlayEl.style.display !== "none") {
        closeModal();
      }
    });
  }

  // QRを作り直して表示する
  function renderQr(url) {
    if (!qrBoxEl || !noteEl || !urlEl) return;

    // 前回QRをクリアして作り直す
    qrBoxEl.innerHTML = "";
    noteEl.style.display = "none";

    // URLテキストは常に併記
    urlEl.textContent = url;

    if (typeof window.QRCode === "function") {
      try {
        // qrcodejsでQRを生成
        new window.QRCode(qrBoxEl, {
          text: url,
          width: 220,
          height: 220,
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined
        });
      } catch (err) {
        // 生成失敗時はフォールバック表示
        console.error("[qrShare] QR生成に失敗しました", err);
        noteEl.textContent = E.t ? E.t("qrshare.failed", "QRの生成に失敗しました") : "QRの生成に失敗しました";
        noteEl.style.display = "block";
      }
    } else {
      // ライブラリ未読込: 注記＋URLテキストのみ
      noteEl.textContent = E.t ? E.t("qrshare.noLib", "QRライブラリ未読込") : "QRライブラリ未読込";
      noteEl.style.display = "block";
    }
  }

  // モーダルを開く
  function openModal() {
    try {
      ensureModal();
      const url = buildShareUrl();
      renderQr(url);
      overlayEl.style.display = "flex";
    } catch (err) {
      console.error("[qrShare] モーダル表示に失敗しました", err);
    }
  }

  // モーダルを閉じる
  function closeModal() {
    if (overlayEl) overlayEl.style.display = "none";
  }

  // ------------------------------------------------------------------
  // #hero-actions に「QR」ボタンを追加
  // ------------------------------------------------------------------
  function mountButton() {
    const host = document.getElementById("hero-actions");
    if (!host) return;
    // 二重生成を防止
    if (host.querySelector(".qrshare-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn qrshare-btn";
    btn.textContent = E.t ? E.t("qrshare.button", "QR") : "QR";
    btn.addEventListener("click", openModal);
    host.appendChild(btn);
  }

  // 起動直後にボタンを設置.DOM未準備なら待ってから設置.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton);
  } else {
    mountButton();
  }
  // 駅マスタ読込完了時にも設置を試みる(枠が後から用意される場合に備える)
  E.on("ready", mountButton);
})();
