// 機能モジュール: 印刷用出力
// #hero-actions に「印刷」ボタンを追加し, クリックで window.print() を呼ぶ.
// 併せて @media print のスタイルを注入し, 入力パネル・ツールバー・地図操作・
// 各種ボタン・背景などを非表示にして, 結果カード/所要時間/ランキングを
// 白地・黒文字で A4縦に収まるよう整える.
(() => {
  "use strict";

  // EkiHubコアが存在しなければ何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ------------------------------------------------------------------
  // 印刷用スタイルを一度だけ注入(機能固有接頭辞: printexport-)
  //   ・非表示対象: 入力パネル/ツールバー/地図操作/機能コントロール/各種ボタン/背景
  //   ・結果系は白地・黒文字へ上書きし, A4縦に収まる余白とフォントに調整
  // ------------------------------------------------------------------
  E.injectStyle(
    "printexport-style",
    `
    @media print {
      /* A4縦・余白の基本設定 */
      @page {
        size: A4 portrait;
        margin: 12mm;
      }

      /* 用紙全体を白地・黒文字に統一 */
      html,
      body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* 装飾・操作系は印刷しない */
      .aurora,
      .toolbar,
      #toolbar,
      .panel,
      #feature-controls,
      .leaflet-control,
      .leaflet-control-container,
      .tool-btn,
      .btn,
      #hero-actions,
      .hero-actions,
      .printexport-btn,
      .foot {
        display: none !important;
      }

      /* レイアウトを1カラム化して結果列を全幅に */
      .app {
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        max-width: none !important;
        width: 100% !important;
      }
      .layout {
        display: block !important;
        grid-template-columns: none !important;
        gap: 0 !important;
      }
      .result {
        display: block !important;
        width: 100% !important;
        gap: 0 !important;
      }

      /* ヘッダーは見出しのみ簡潔に残す */
      .hero {
        background: none !important;
        box-shadow: none !important;
        padding: 0 0 6mm !important;
        margin: 0 0 4mm !important;
        border-bottom: 1px solid #000000 !important;
        text-align: left !important;
      }
      .hero__badge {
        color: #000000 !important;
        background: none !important;
        font-size: 11pt !important;
        padding: 0 !important;
      }
      .hero__title {
        color: #000000 !important;
        font-size: 18pt !important;
        margin: 2mm 0 1mm !important;
      }
      .hero__title .accent {
        color: #000000 !important;
        /* グラデーションテキストを解除して黒文字で表示 */
        background: none !important;
        -webkit-background-clip: unset !important;
        background-clip: unset !important;
        -webkit-text-fill-color: #000000 !important;
      }
      .hero__lead {
        color: #000000 !important;
        font-size: 9pt !important;
        margin: 0 !important;
      }

      /* 結果カード: 白地・黒文字・枠線で見やすく */
      .result-card {
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: 1px solid #000000 !important;
        border-radius: 6px !important;
        padding: 5mm !important;
        margin: 0 0 4mm !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .result-card.is-empty {
        display: none !important;
      }
      .result-card__eyebrow {
        color: #000000 !important;
        font-size: 9pt !important;
      }
      .result-card__name {
        color: #000000 !important;
        font-size: 20pt !important;
        margin: 1mm 0 !important;
        /* グラデーションテキストを解除して黒文字で表示 */
        background: none !important;
        -webkit-background-clip: unset !important;
        background-clip: unset !important;
        -webkit-text-fill-color: #000000 !important;
      }
      .result-card__kana {
        color: #000000 !important;
        font-size: 9pt !important;
      }
      .result-card__range {
        color: #000000 !important;
        font-size: 9pt !important;
      }

      /* 路線チップ: 枠線付きの単色表示 */
      .chips li {
        background: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #000000 !important;
      }

      /* メトリクス: 罫線で区切った白地表示 */
      .metric {
        background: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #000000 !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .metric__value {
        color: #000000 !important;
        font-size: 14pt !important;
      }
      .metric__label {
        color: #000000 !important;
        font-size: 8pt !important;
      }

      /* 地図は印刷不要(操作不能なため非表示・余白も消す) */
      .map {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        border: none !important;
      }

      /* 所要時間リスト: 常に表示し白地・黒文字へ */
      .travel-list {
        display: block !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: 1px solid #000000 !important;
        border-radius: 6px !important;
        padding: 4mm !important;
        margin: 0 0 4mm !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .travel-list__title,
      .ranking__title {
        color: #000000 !important;
        font-size: 10pt !important;
        margin: 0 0 2mm !important;
      }
      .travel-list ul,
      .ranking ul {
        margin: 0 !important;
      }
      .travel-list li,
      .ranking li {
        background: #ffffff !important;
        color: #000000 !important;
        border: 1px solid #000000 !important;
        box-shadow: none !important;
        font-size: 9pt !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* 候補ランキング: 常に表示し白地・黒文字へ */
      .ranking {
        display: block !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: 1px solid #000000 !important;
        border-radius: 6px !important;
        padding: 4mm !important;
        margin: 0 0 4mm !important;
      }

      /* 機能パネル枠は不要な装飾を抑える */
      #feature-panels {
        background: none !important;
      }
      .fpanel {
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: 1px solid #000000 !important;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      /* リンクのURL展開は抑止(見た目を簡潔に保つ) */
      a {
        color: #000000 !important;
        text-decoration: none !important;
      }
    }
  `
  );

  // ------------------------------------------------------------------
  // 印刷を実行する
  // ------------------------------------------------------------------
  function doPrint() {
    try {
      // ブラウザの印刷ダイアログを開く
      window.print();
    } catch (err) {
      // 印刷に失敗してもアプリ全体は止めない
      console.error("[printExport] 印刷の起動に失敗しました", err);
    }
  }

  // ------------------------------------------------------------------
  // #hero-actions に「印刷」ボタンを追加
  // ------------------------------------------------------------------
  function mountButton() {
    const host = document.getElementById("hero-actions");
    if (!host) return;
    // 二重生成を防止
    if (host.querySelector(".printexport-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn printexport-btn";
    btn.textContent = E.t ? E.t("printexport.button", "印刷") : "印刷";
    btn.addEventListener("click", doPrint);
    host.appendChild(btn);
  }

  // 起動直後にボタンを設置.DOM未準備なら待ってから設置.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountButton);
  } else {
    mountButton();
  }
  // 枠が後から用意される場合に備え, ready/result でも設置を試みる
  E.on("ready", mountButton);
  E.on("result", mountButton);
})();
