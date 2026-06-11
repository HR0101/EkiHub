// 検索履歴とお気に入りモジュール
// window.EkiHub を介してコアと連携する。グローバル汚染は行わない。
(() => {
  "use strict";

  // EkiHub コアが未読込なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ===== 定数定義 =====
  // 永続化キー
  const HISTORY_KEY = "ekihub-history";
  const FAVORITES_KEY = "ekihub-favorites";
  // 履歴の最大保持件数
  const MAX_HISTORY = 10;
  // 主要DOM要素のid
  const BUTTON_ID = "historyFavorites-btn";
  const PANEL_ID = "historyFavorites-panel";

  // ===== モジュール内状態 =====
  // ツールバーの開閉ボタン
  let buttonEl = null;
  // ドロップダウンパネル
  let panelEl = null;
  // パネルの開閉状態
  let isOpen = false;
  // 外側クリック検知用ハンドラ(開いている間だけ登録)
  let outsideClickHandler = null;

  // ===== スタイル注入(機能固有接頭辞 hf-) =====
  E.injectStyle(
    "historyFavorites-style",
    `
    .hf--panel {
      position: fixed;
      z-index: 1800;
      width: 300px;
      max-height: 60vh;
      overflow-y: auto;
      padding: 8px;
      border-radius: 10px;
      background: var(--bg-panel-solid, #141a2c);
      color: var(--text-main, #eef2ff);
      border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
      display: none;
    }
    .hf--panel.is-open {
      display: block;
      animation: fadeUp 0.18s ease both;
    }
    .hf--section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.65;
      margin: 8px 4px 4px;
    }
    .hf--section-title:first-child {
      margin-top: 2px;
    }
    .hf--empty {
      font-size: 12px;
      opacity: 0.55;
      padding: 6px 6px 10px;
    }
    .hf--item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 4px;
      border-radius: 8px;
    }
    .hf--item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .hf--load {
      flex: 1 1 auto;
      min-width: 0;
      text-align: left;
      background: transparent;
      border: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 2px 4px;
    }
    .hf--stations {
      display: block;
      font-size: 13px;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hf--meta {
      display: block;
      font-size: 11px;
      opacity: 0.55;
      margin-top: 2px;
    }
    .hf--icon-btn {
      flex: 0 0 auto;
      width: 26px;
      height: 26px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      border-radius: 6px;
      font-size: 14px;
      opacity: 0.7;
    }
    .hf--icon-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }
    .hf--star.is-active {
      color: #f5c518;
      opacity: 1;
    }
    .hf--divider {
      height: 1px;
      margin: 6px 2px;
      background: rgba(255, 255, 255, 0.1);
    }
    `
  );

  // ===== localStorage 入出力(失敗時は空配列) =====
  // 指定キーから配列を安全に読み込む
  function loadList(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("historyFavorites: 読込に失敗しました(" + key + ")", err);
      return [];
    }
  }

  // 指定キーへ配列を安全に保存する
  function saveList(key, list) {
    try {
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
      // 保存失敗(容量超過・プライベートモード等)でも動作は継続する
      console.warn("historyFavorites: 保存に失敗しました(" + key + ")", err);
    }
  }

  // ===== エントリ操作ヘルパ =====
  // 入力行配列から駅名のみを抽出する(空名は除外)
  function extractStationNames(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => (r && r.name != null ? String(r.name).trim() : ""))
      .filter((n) => n.length > 0);
  }

  // エントリの同一判定キー(駅組合せの正規化文字列)
  // 順序の違いは同一とみなすため並べ替えてから連結する
  function comboKey(rows) {
    const names = extractStationNames(rows).slice().sort();
    return names.join("");
  }

  // 表示用の駅名連結テキスト(ラベルがあれば併記)
  function comboLabel(rows) {
    if (!Array.isArray(rows)) return "";
    return rows
      .map((r) => {
        if (!r || r.name == null) return "";
        const name = String(r.name).trim();
        if (name.length === 0) return "";
        const label = r.label != null ? String(r.label).trim() : "";
        return label.length > 0 ? label + "（" + name + "）" : name;
      })
      .filter((s) => s.length > 0)
      .join(" / ");
  }

  // 現在状態から保存用エントリを生成する
  function buildEntry() {
    const inputs = (E.getInputs && E.getInputs()) || [];
    const state = (E.getState && E.getState()) || {};
    // 駅名を持つ行のみ保持する
    const rows = inputs
      .filter((r) => r && r.name != null && String(r.name).trim().length > 0)
      .map((r) => ({
        name: String(r.name).trim(),
        label: r.label != null ? String(r.label) : "",
        people: r.people != null ? r.people : 1,
      }));
    return {
      rows: rows,
      mode: state.currentMode != null ? state.currentMode : null,
      w: typeof state.fairnessWeight === "number" ? state.fairnessWeight : null,
      fw: typeof state.fareWeight === "number" ? state.fareWeight : null,
      time: Date.now(),
    };
  }

  // ===== 履歴更新 =====
  // 算出完了時に呼ばれ,現在の入力を履歴先頭へ追加する
  function pushHistory() {
    try {
      const entry = buildEntry();
      // 駅が1件も無い場合は記録しない
      if (!entry.rows || entry.rows.length === 0) return;

      const key = comboKey(entry.rows);
      let history = loadList(HISTORY_KEY);
      // 同一の駅組合せを重複排除
      history = history.filter((item) => comboKey(item && item.rows) !== key);
      // 先頭追加し最大件数で切り詰め
      history.unshift(entry);
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      saveList(HISTORY_KEY, history);

      // 開いていれば即時反映
      if (isOpen) renderPanel();
    } catch (err) {
      console.error("historyFavorites: 履歴追加に失敗しました", err);
    }
  }

  // ===== お気に入り操作 =====
  // 指定組合せがお気に入りに含まれるか
  function isFavorited(rows) {
    const key = comboKey(rows);
    return loadList(FAVORITES_KEY).some(
      (item) => comboKey(item && item.rows) === key
    );
  }

  // お気に入りのトグル(追加 / 解除)
  function toggleFavorite(entry) {
    try {
      const key = comboKey(entry && entry.rows);
      if (!key) return;
      let favorites = loadList(FAVORITES_KEY);
      const exists = favorites.some(
        (item) => comboKey(item && item.rows) === key
      );
      if (exists) {
        // 解除
        favorites = favorites.filter(
          (item) => comboKey(item && item.rows) !== key
        );
      } else {
        // 追加(先頭へ)
        favorites.unshift(entry);
      }
      saveList(FAVORITES_KEY, favorites);
      renderPanel();
    } catch (err) {
      console.error("historyFavorites: お気に入り更新に失敗しました", err);
    }
  }

  // 履歴から1件削除する
  function removeHistory(entry) {
    try {
      const key = comboKey(entry && entry.rows);
      if (!key) return;
      const history = loadList(HISTORY_KEY).filter(
        (item) => comboKey(item && item.rows) !== key
      );
      saveList(HISTORY_KEY, history);
      renderPanel();
    } catch (err) {
      console.error("historyFavorites: 履歴削除に失敗しました", err);
    }
  }

  // ===== エントリ適用 =====
  // エントリの入力を反映し再算出する
  function applyEntry(entry) {
    try {
      if (!entry || !Array.isArray(entry.rows) || entry.rows.length === 0) {
        return;
      }
      // setOrigins はオブジェクト配列を受け付ける(name/label/people)
      const list = entry.rows.map((r) => ({
        name: r.name,
        label: r.label != null ? r.label : "",
        people: r.people != null ? r.people : 1,
      }));
      // 運賃重みは反映可能なので可能なら設定(modeトグルAPIは無いため設定しない)
      if (typeof entry.fw === "number" && E.setFareWeight) {
        try {
          E.setFareWeight(entry.fw);
        } catch (err) {
          // 運賃重み設定に失敗しても入力反映は継続する
          console.warn("historyFavorites: 運賃重みの反映に失敗しました", err);
        }
      }
      if (E.setOrigins) E.setOrigins(list, { compute: true });
      // 適用後はパネルを閉じる
      closePanel();
    } catch (err) {
      console.error("historyFavorites: エントリ適用に失敗しました", err);
    }
  }

  // ===== 描画 =====
  // メタ情報(モード・件数)テキストを組み立てる
  function buildMetaText(entry) {
    const parts = [];
    if (entry && entry.mode) {
      parts.push("モード" + String(entry.mode));
    }
    const count = entry && Array.isArray(entry.rows) ? entry.rows.length : 0;
    parts.push(count + "駅");
    return parts.join(" ・ ");
  }

  // 1件分の行要素を生成する
  // variant: "favorite" | "history"
  function createItemEl(entry, variant) {
    const item = document.createElement("div");
    item.className = "hf--item";

    // ★ お気に入りトグル
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = "hf--icon-btn hf--star";
    const favorited = isFavorited(entry && entry.rows);
    if (favorited) starBtn.classList.add("is-active");
    starBtn.textContent = favorited ? "★" : "☆";
    starBtn.title = favorited
      ? E.t
        ? E.t("history.unfavorite", "お気に入り解除")
        : "お気に入り解除"
      : E.t
      ? E.t("history.favorite", "お気に入りに追加")
      : "お気に入りに追加";
    starBtn.setAttribute("aria-label", E.escapeHtml(starBtn.title));
    starBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleFavorite(entry);
    });
    item.appendChild(starBtn);

    // 入力反映ボタン(駅名連結 + メタ)
    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "hf--load";

    const stations = document.createElement("span");
    stations.className = "hf--stations";
    // 文字列描画は escapeHtml を通す
    stations.textContent = comboLabel(entry && entry.rows) || "(駅なし)";
    stations.title = stations.textContent;
    loadBtn.appendChild(stations);

    const meta = document.createElement("span");
    meta.className = "hf--meta";
    meta.textContent = buildMetaText(entry);
    loadBtn.appendChild(meta);

    loadBtn.addEventListener("click", () => applyEntry(entry));
    item.appendChild(loadBtn);

    // 履歴のみ削除ボタンを付与する
    if (variant === "history") {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "hf--icon-btn hf--del";
      delBtn.textContent = "×";
      delBtn.title = E.t ? E.t("history.delete", "履歴から削除") : "履歴から削除";
      delBtn.setAttribute("aria-label", E.escapeHtml(delBtn.title));
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        removeHistory(entry);
      });
      item.appendChild(delBtn);
    }

    return item;
  }

  // 見出し要素を生成する
  function createTitleEl(text) {
    const el = document.createElement("div");
    el.className = "hf--section-title";
    el.textContent = text;
    return el;
  }

  // 空状態メッセージを生成する
  function createEmptyEl(text) {
    const el = document.createElement("div");
    el.className = "hf--empty";
    el.textContent = text;
    return el;
  }

  // パネル内容を再構築する
  function renderPanel() {
    if (!panelEl) return;
    // 既存内容をクリア
    panelEl.innerHTML = "";

    const favorites = loadList(FAVORITES_KEY);
    const history = loadList(HISTORY_KEY);

    // ----- お気に入り(上部常設) -----
    panelEl.appendChild(
      createTitleEl(E.t ? E.t("history.favorites", "お気に入り") : "お気に入り")
    );
    if (favorites.length === 0) {
      panelEl.appendChild(
        createEmptyEl(
          E.t ? E.t("history.noFavorites", "お気に入りはありません") : "お気に入りはありません"
        )
      );
    } else {
      favorites.forEach((entry) => {
        panelEl.appendChild(createItemEl(entry, "favorite"));
      });
    }

    // 区切り線
    const divider = document.createElement("div");
    divider.className = "hf--divider";
    panelEl.appendChild(divider);

    // ----- 検索履歴 -----
    panelEl.appendChild(
      createTitleEl(E.t ? E.t("history.recent", "検索履歴") : "検索履歴")
    );
    if (history.length === 0) {
      panelEl.appendChild(
        createEmptyEl(
          E.t ? E.t("history.noHistory", "履歴はありません") : "履歴はありません"
        )
      );
    } else {
      history.forEach((entry) => {
        panelEl.appendChild(createItemEl(entry, "history"));
      });
    }
  }

  // ===== 開閉制御 =====
  // 外側クリックでパネルを閉じる
  function handleOutsideClick(ev) {
    if (!panelEl || !buttonEl) return;
    const target = ev.target;
    // ボタン・パネル内部のクリックは無視
    if (panelEl.contains(target) || buttonEl.contains(target)) return;
    closePanel();
  }

  // パネルをボタン直下に配置する（画面端からはみ出さないよう調整）
  function positionPanel() {
    if (!buttonEl || !panelEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const panelW = 300;
    const gap = 6;

    let top  = rect.bottom + gap;
    let left = rect.left;

    // 右端からはみ出す場合は右揃え
    if (left + panelW > window.innerWidth - 12) {
      left = window.innerWidth - panelW - 12;
    }
    left = Math.max(12, left);

    // 下端からはみ出す場合はボタン上に出す
    const panelH = panelEl.offsetHeight || 300;
    if (top + panelH > window.innerHeight - 12) {
      top = rect.top - panelH - gap;
    }

    panelEl.style.top  = Math.max(8, top) + "px";
    panelEl.style.left = left + "px";
  }

  // パネルを開く
  function openPanel() {
    if (!panelEl) return;
    renderPanel();
    panelEl.classList.add("is-open");
    isOpen = true;
    if (buttonEl) buttonEl.setAttribute("aria-expanded", "true");
    positionPanel();
    // 外側クリック監視を登録(次のイベントループで付与し直後のクリックを無視)
    outsideClickHandler = handleOutsideClick;
    window.setTimeout(() => {
      if (outsideClickHandler) {
        document.addEventListener("click", outsideClickHandler, true);
      }
    }, 0);
  }

  // パネルを閉じる
  function closePanel() {
    if (panelEl) panelEl.classList.remove("is-open");
    isOpen = false;
    if (buttonEl) buttonEl.setAttribute("aria-expanded", "false");
    if (outsideClickHandler) {
      document.removeEventListener("click", outsideClickHandler, true);
      outsideClickHandler = null;
    }
  }

  // 開閉トグル
  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  // ===== マウント =====
  // ツールバーへボタンを設置し、パネルは body 直下に配置する
  function mount() {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) {
      console.warn("historyFavorites: #toolbar が見つかりません");
      return;
    }
    if (document.getElementById(BUTTON_ID)) return;

    buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.id = BUTTON_ID;
    buttonEl.className = "tool-btn hf--btn";
    buttonEl.textContent = E.t ? E.t("history.button", "履歴") : "履歴";
    buttonEl.setAttribute("aria-haspopup", "true");
    buttonEl.setAttribute("aria-expanded", "false");
    buttonEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      togglePanel();
    });
    toolbar.appendChild(buttonEl);

    // パネルは body 直下に置き position:fixed で位置を制御する
    panelEl = document.createElement("div");
    panelEl.id = PANEL_ID;
    panelEl.className = "hf--panel";
    document.body.appendChild(panelEl);
  }

  // ===== 初期化 =====
  function init() {
    try {
      // 起動直後に枠(ボタン・パネル)を先に作る
      mount();
      // 算出完了で履歴に追加
      if (E.on) E.on("result", pushHistory);
    } catch (err) {
      console.error("historyFavorites: 初期化に失敗しました", err);
    }
  }

  // DOM 準備状況に応じて初期化する
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
