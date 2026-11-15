// ===== EkiHub 機能モジュール: 言語切替 (i18n) =====
// 役割: 日本語(ja)と英語(en)の切替。#toolbar にボタンを追加し、
//       [data-i18n] 属性を持つ要素のテキストを辞書で差し替える。
//       window.EkiHub.t を上書きし、現在言語の辞書値を返すようにする。
//
// window.EkiHub を介してコアと連携する。他ファイルは編集しない。

(() => {
  "use strict";

  // コア未読込時は何もしない（ガード）
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ---- 定数 ----
  const STORAGE_KEY = "ekihub-lang"; // localStorage 永続化キー
  const DEFAULT_LANG = "ja"; // 既定言語
  const SUPPORTED = ["ja", "en"]; // 対応言語
  const STYLE_ID = "ekihub-i18n"; // 注入スタイルの一意ID

  // ---- 辞書 ----
  // ja は HTML 内の元テキストに合わせる。en は自然な英訳。
  // title は span を含むため HTML 文字列で保持する（en時 innerHTML 差し替え）。
  const DICTIONARY = {
    ja: {
      title: 'みんなの<span class="accent">中心駅</span>を探す',
      lead: "複数人の最寄駅を入力すると、全員が集まりやすい駅をAIロジックが提案します。",
      compute: "中心駅を算出する",
      language: "言語"
    },
    en: {
      title: 'Find the <span class="accent">central station</span> for everyone',
      lead: "Enter each person's nearest station, and our AI logic suggests the easiest station for all to gather.",
      compute: "Find central station",
      language: "Language"
    }
  };

  // title だけは HTML を許可するキー（その他はテキストとして扱う）
  const HTML_KEYS = new Set(["title"]);

  // ---- 状態 ----
  let currentLang = DEFAULT_LANG; // 現在の言語
  let langButton = null; // ツールバーのボタン参照
  // [data-i18n] 要素ごとに初期(ja)テキスト/HTMLを保持する。
  // 辞書に値が無いキーでも ja 復帰できるようにするための保険。
  const originalContents = new WeakMap();

  // ====================================================================
  // ヘルパー
  // ====================================================================

  // 保存済み言語を安全に読み込む（未対応値・例外はフォールバック）
  function loadSavedLang() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (error) {
      // localStorage 非対応/プライベートモード等は既定値で続行
      console.warn("[EkiHub i18n] 言語設定の読込に失敗:", error);
    }
    return DEFAULT_LANG;
  }

  // 言語を保存する（失敗しても致命的ではない）
  function saveLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.warn("[EkiHub i18n] 言語設定の保存に失敗:", error);
    }
  }

  // 現在言語の辞書から値を取得（無ければ undefined）
  function lookup(key) {
    const dict = DICTIONARY[currentLang];
    if (!dict) return undefined;
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined;
  }

  // ====================================================================
  // 言語適用
  // ====================================================================

  // [data-i18n] を持つ全要素のテキスト/HTMLを現在言語で差し替える
  function applyLanguage() {
    let nodes;
    try {
      nodes = document.querySelectorAll("[data-i18n]");
    } catch (error) {
      console.error("[EkiHub i18n] 要素取得に失敗:", error);
      return;
    }
    if (!nodes || !nodes.length) {
      // まだ DOM が無い場合もあるが、ボタン文言だけは更新しておく
      updateButtonLabel();
      updateHtmlLang();
      return;
    }

    nodes.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const useHtml = HTML_KEYS.has(key);

      // 初回出会った要素の元コンテンツ(ja想定)を保持する
      if (!originalContents.has(el)) {
        originalContents.set(el, { text: el.textContent, html: el.innerHTML });
      }

      // 差し替え値: 辞書にあればそれ、無ければ ja 復帰時は元値を使う
      const dictValue = lookup(key);
      let value = dictValue;
      if (value === undefined) {
        const orig = originalContents.get(el);
        value = useHtml ? orig.html : orig.text;
      }

      if (useHtml) {
        // title は span を含むため innerHTML で適用（辞書値は固定の安全な文字列）
        if (el.innerHTML !== value) el.innerHTML = value;
      } else {
        // 通常キーはテキストとして適用（エスケープ不要・XSS回避）
        if (el.textContent !== value) el.textContent = value;
      }
    });

    updateButtonLabel();
    updateHtmlLang();
  }

  // <html lang> 属性を現在言語に合わせる（アクセシビリティ）
  function updateHtmlLang() {
    const root = document.documentElement;
    if (root) root.setAttribute("lang", currentLang);
  }

  // ボタン文言を現在言語に合わせて更新する
  function updateButtonLabel() {
    if (!langButton) return;
    // ボタンは「次に切り替わる言語」を示すと分かりにくいので、
    // 現在言語の辞書の language ラベル＋言語コードを表示する。
    const label = lookup("language") || (currentLang === "ja" ? "言語" : "Language");
    const code = currentLang === "ja" ? "EN" : "日本語"; // 押すと切り替わる先
    langButton.textContent = label + ": " + code;
    langButton.setAttribute(
      "aria-label",
      currentLang === "ja" ? "言語を英語に切り替える" : "Switch language to Japanese"
    );
  }

  // 言語を設定して適用・保存する
  function setLanguage(lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    currentLang = lang;
    if (persist) saveLang(lang);
    applyLanguage();
  }

  // ja ⇔ en をトグルする
  function toggleLanguage() {
    setLanguage(currentLang === "ja" ? "en" : "ja", true);
  }

  // ====================================================================
  // E.t の上書き
  // ====================================================================
  // 現在言語の辞書値があれば返し、無ければ fallback を返す。
  E.t = (key, fallback) => {
    const value = lookup(key);
    return value !== undefined ? value : fallback;
  };

  // ====================================================================
  // ツールバーへのボタン追加
  // ====================================================================
  function mountToolbarButton() {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return; // 枠が無ければスキップ（nullガード）
    if (langButton) return; // 二重生成防止

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn ekihub-i18n__btn"; // 機能固有接頭辞を付与
    btn.addEventListener("click", () => {
      try {
        toggleLanguage();
      } catch (error) {
        console.error("[EkiHub i18n] 言語切替に失敗:", error);
      }
    });

    langButton = btn;
    toolbar.appendChild(btn);
    updateButtonLabel();
  }

  // ====================================================================
  // スタイル注入（機能固有クラス接頭辞 ekihub-i18n__）
  // ====================================================================
  E.injectStyle(
    STYLE_ID,
    `
    .ekihub-i18n__btn {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    `
  );

  // ====================================================================
  // 初期化
  // ====================================================================
  function init() {
    currentLang = loadSavedLang(); // 保存値を反映
    mountToolbarButton(); // #toolbar にボタン追加
    applyLanguage(); // 起動時に一度適用（ready 前後どちらでも動く）
  }

  // ready 前後どちらでも動くよう、起動時に必ず適用する。
  // DOM がまだ無い可能性に備え DOMContentLoaded もフックする。
  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  } catch (error) {
    console.error("[EkiHub i18n] 初期化に失敗:", error);
  }

  // 駅マスタ読込完了時にも再適用（コアが描画した要素にも反映）
  E.on("ready", () => {
    try {
      applyLanguage();
    } catch (error) {
      console.error("[EkiHub i18n] ready 後の適用に失敗:", error);
    }
  });

  // 結果描画後も静的 i18n 要素を取りこぼさないよう再適用する。
  E.on("result", () => {
    try {
      applyLanguage();
    } catch (error) {
      console.error("[EkiHub i18n] result 後の適用に失敗:", error);
    }
  });
})();
