// ====================================================================
// EkiHub 機能モジュール: 集合駅周辺スポット
// 選択中の駅周辺のカフェ/居酒屋等を取得し,リストと地図に表示する.
// グローバル window.EkiHub を介してコアと連携する.
// ====================================================================
(() => {
  "use strict";

  // EkiHub コアが存在しない場合は何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 機能固有の定数
  const FEATURE_ID = "nearbyspots";
  const SEARCH_RADIUS_M = 400; // 検索半径(メートル)
  const FLY_ZOOM = 16; // リスト項目クリック時のズーム

  // カテゴリ定義(値はAPIのcategory,ラベルは日本語表示)
  const CATEGORIES = [
    { value: "cafe", label: E.t("spots.cat.cafe", "カフェ") },
    { value: "restaurant", label: E.t("spots.cat.restaurant", "レストラン") },
    { value: "izakaya", label: E.t("spots.cat.izakaya", "居酒屋・バー") },
    { value: "karaoke", label: E.t("spots.cat.karaoke", "カラオケ") },
    { value: "convenience", label: E.t("spots.cat.convenience", "コンビニ") },
    { value: "park", label: E.t("spots.cat.park", "公園") },
  ];

  // 状態メッセージ(i18n対応 + フォールバック)
  const MSG_PICK = E.t("spots.pick", "カテゴリを選んでください");
  const MSG_LOADING = E.t("spots.loading", "検索中…");
  const MSG_EMPTY = E.t("spots.empty", "見つかりませんでした");
  const MSG_ERROR = E.t("spots.error", "取得できませんでした(ネットワーク)");
  const MSG_NO_STATION = E.t("spots.noStation", "対象の駅が選択されていません");

  // 進行中の取得を識別/中断するための状態
  let requestSeq = 0; // 取得世代。新しい取得や駅変更で増やし、古い結果を破棄する
  let inflightAbort = null; // 進行中fetchのAbortController
  // 現在選択中のカテゴリ(再描画判定用)
  let activeCategory = null;

  // ------------------------------------------------------------------
  // スタイル注入(機能固有クラス接頭辞 nsp- を使用)
  // ------------------------------------------------------------------
  E.injectStyle(
    FEATURE_ID,
    `
    .nsp-cats {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }
    .nsp-cat.is-active {
      outline: 2px solid currentColor;
      outline-offset: 1px;
      font-weight: 600;
    }
    .nsp-status {
      font-size: 13px;
      line-height: 1.5;
      opacity: 0.85;
      margin: 4px 0;
    }
    .nsp-status--error { color: #b00020; opacity: 1; }
    .nsp-spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 6px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      vertical-align: -1px;
      animation: nsp-spin 0.8s linear infinite;
    }
    @keyframes nsp-spin { to { transform: rotate(360deg); } }
    .nsp-list {
      list-style: none;
      margin: 4px 0 0 0;
      padding: 0;
      max-height: 280px;
      overflow-y: auto;
    }
    .nsp-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .nsp-item:hover,
    .nsp-item:focus-visible {
      background: rgba(127, 127, 127, 0.12);
      border-color: rgba(127, 127, 127, 0.25);
      outline: none;
    }
    .nsp-item__name { font-size: 13px; font-weight: 600; }
    .nsp-item__tag { font-size: 11px; opacity: 0.7; }
    `
  );

  // ------------------------------------------------------------------
  // DOM 構築(#feature-panels に .fpanel パネルを追加)
  // ------------------------------------------------------------------
  const host = document.getElementById("feature-panels");
  if (!host) return; // 拡張枠が無ければ何もしない

  // パネル本体
  const panel = document.createElement("section");
  panel.className = "fpanel";

  // 見出し
  const title = document.createElement("h3");
  title.className = "fpanel__title";
  title.textContent = E.t("spots.title", "周辺スポット");
  panel.appendChild(title);

  // カテゴリボタン群
  const catWrap = document.createElement("div");
  catWrap.className = "nsp-cats";
  // ボタンへの参照(activeハイライト切替に使用)
  const catButtons = [];
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn nsp-cat";
    btn.textContent = cat.label;
    btn.dataset.category = cat.value;
    btn.addEventListener("click", () => handleCategoryClick(cat.value));
    catButtons.push(btn);
    catWrap.appendChild(btn);
  });
  panel.appendChild(catWrap);

  // 状態メッセージ
  const status = document.createElement("p");
  status.className = "nsp-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = MSG_PICK;
  panel.appendChild(status);

  // スポット一覧
  const list = document.createElement("ul");
  list.className = "nsp-list";
  panel.appendChild(list);

  host.appendChild(panel);

  // ------------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------------

  // 状態メッセージを表示する(isError=true でエラー色)
  // showSpinner=true で前にスピナーを付ける
  function setStatus(text, isError, showSpinner) {
    status.classList.toggle("nsp-status--error", Boolean(isError));
    status.textContent = "";
    if (showSpinner) {
      const spinner = document.createElement("span");
      spinner.className = "nsp-spinner";
      spinner.setAttribute("aria-hidden", "true");
      status.appendChild(spinner);
    }
    status.appendChild(document.createTextNode(text));
  }

  // 地図のマーカーを全消去する(機能用レイヤのみ)
  function clearMarkers() {
    try {
      if (E.featureLayer && typeof E.featureLayer.clearLayers === "function") {
        E.featureLayer.clearLayers();
      }
    } catch (error) {
      console.error("[nearbySpots] マーカー消去に失敗しました:", error);
    }
  }

  // カテゴリボタンのハイライトを更新する
  function updateActiveButton(category) {
    catButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.category === category);
    });
  }

  // 一覧とマーカーを初期状態へ戻す
  function resetView(message, isError) {
    // 進行中の取得を無効化・中断する
    requestSeq += 1;
    if (inflightAbort) {
      try {
        inflightAbort.abort();
      } catch (error) {
        // 中断失敗は無視
      }
      inflightAbort = null;
    }
    activeCategory = null;
    list.innerHTML = "";
    clearMarkers();
    updateActiveButton(null);
    setStatus(message || MSG_PICK, Boolean(isError), false);
  }

  // タグ情報から短い説明文を組み立てる(任意)
  function describeTags(tags) {
    if (!tags || typeof tags !== "object") return "";
    // 代表的なキーを優先的に拾う
    const cuisine = tags.cuisine || tags["cuisine"];
    if (typeof cuisine === "string" && cuisine) return cuisine;
    const brand = tags.brand || tags["brand"];
    if (typeof brand === "string" && brand) return brand;
    return "";
  }

  // ------------------------------------------------------------------
  // スポット描画
  // ------------------------------------------------------------------

  // 1件のスポットをリストへ追加し,地図へマーカーを置く
  function renderSpot(spot) {
    if (!spot || typeof spot.lat !== "number" || typeof spot.lng !== "number") {
      return;
    }
    const name = spot.name || E.t("spots.unnamed", "(名称不明)");
    const tagText = describeTags(spot.tags);

    // リスト項目(クリックで地図移動)
    const item = document.createElement("li");
    item.className = "nsp-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");

    const nameEl = document.createElement("span");
    nameEl.className = "nsp-item__name";
    nameEl.innerHTML = E.escapeHtml(name);
    item.appendChild(nameEl);

    if (tagText) {
      const tagEl = document.createElement("span");
      tagEl.className = "nsp-item__tag";
      tagEl.innerHTML = E.escapeHtml(tagText);
      item.appendChild(tagEl);
    }

    // クリック/Enterで該当スポットへ地図移動
    const fly = () => {
      try {
        if (typeof E.flyTo === "function") {
          E.flyTo(spot.lat, spot.lng, FLY_ZOOM);
        }
      } catch (error) {
        console.error("[nearbySpots] 地図移動に失敗しました:", error);
      }
    };
    item.addEventListener("click", fly);
    item.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        fly();
      }
    });
    list.appendChild(item);

    // 地図へ小マーカーを追加
    try {
      if (
        window.L &&
        typeof window.L.circleMarker === "function" &&
        E.featureLayer &&
        typeof E.featureLayer.addLayer === "function"
      ) {
        const marker = window.L.circleMarker([spot.lat, spot.lng], {
          radius: 6,
          weight: 2,
          color: "#1f6feb",
          fillColor: "#1f6feb",
          fillOpacity: 0.7,
        });
        // ポップアップとツールチップに名称を表示
        const safeName = E.escapeHtml(name);
        if (typeof marker.bindTooltip === "function") {
          marker.bindTooltip(safeName);
        }
        if (typeof marker.bindPopup === "function") {
          marker.bindPopup(safeName);
        }
        // マーカークリックでも地図移動
        if (typeof marker.on === "function") {
          marker.on("click", fly);
        }
        E.featureLayer.addLayer(marker);
      }
    } catch (error) {
      console.error("[nearbySpots] マーカー追加に失敗しました:", error);
    }
  }

  // ------------------------------------------------------------------
  // 取得処理
  // ------------------------------------------------------------------

  // カテゴリ押下時のハンドラ
  function handleCategoryClick(category) {
    // 対象駅を取得
    let selected = null;
    try {
      selected = E.getSelected ? E.getSelected() : null;
    } catch (error) {
      console.error("[nearbySpots] 選択駅の取得に失敗しました:", error);
      selected = null;
    }
    if (!selected || typeof selected.lat !== "number" || typeof selected.lng !== "number") {
      // 対象駅が無い場合はリスト/マーカーを消して案内
      activeCategory = null;
      list.innerHTML = "";
      clearMarkers();
      updateActiveButton(null);
      setStatus(MSG_NO_STATION, false, false);
      return;
    }

    activeCategory = category;
    updateActiveButton(category);
    fetchSpots(selected.lat, selected.lng, category);
  }

  // カテゴリ -> Overpassのタグ条件（ブラウザ直接取得のフォールバック用）
  const OVERPASS_TAGS = {
    cafe: '["amenity"="cafe"]',
    restaurant: '["amenity"="restaurant"]',
    izakaya: '["amenity"~"bar|pub|biergarten"]',
    fastfood: '["amenity"="fast_food"]',
    karaoke: '["leisure"="karaoke"]',
    convenience: '["shop"="convenience"]',
    park: '["leisure"="park"]'
  };
  // Overpassミラー（ブラウザから直接叩く。OverpassはCORS許可済み）
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  // 各ミラーへの個別タイムアウト（1ミラーが遅くても次へ進めるようにする）
  const PER_MIRROR_TIMEOUT_MS = 15000;

  // 中断用エラーを作る（取得世代が古くなったとき用）
  function supersededError() {
    const e = new Error("superseded");
    e.name = "AbortError";
    return e;
  }

  // カテゴリごとに期待するタグ値を定義
  // Overpassクエリが返してきた要素のタグを二重チェックし、誤タグ付きデータを除外する
  const CATEGORY_TAG_CHECK = {
    cafe:        (t) => t.amenity === "cafe",
    restaurant:  (t) => t.amenity === "restaurant",
    izakaya:     (t) => /^(bar|pub|biergarten)$/.test(t.amenity || ""),
    fastfood:    (t) => t.amenity === "fast_food",
    karaoke:     (t) => t.leisure === "karaoke",
    convenience: (t) => t.shop === "convenience",
    park:        (t) => t.leisure === "park",
  };

  // 居酒屋カテゴリで名前が明らかに別業態（ホール・センター・会館等）のものを除外する
  // OSM の誤タグ付けによる混入対策
  const IZAKAYA_NAME_EXCLUDE = /(?:ホール|文化センター|会館|公会堂|体育館|図書館|学校|大学|病院|クリニック|診療所|薬局|神社|寺院?|教会|郵便局|銀行|警察署|消防署|市役所|区役所|町役場)/;

  // Overpassレスポンスを内部形式へ正規化する
  function parseOverpass(raw, category) {
    const seen = new Set();
    const out = [];
    const els = raw && Array.isArray(raw.elements) ? raw.elements : [];
    const tagCheck = CATEGORY_TAG_CHECK[category];
    for (const el of els) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:ja"];
      if (!name) continue;
      // タグが実際にカテゴリと一致するか検証（OSMの誤タグ付き要素を除外）
      if (tagCheck && !tagCheck(tags)) continue;
      // 居酒屋カテゴリで明らかに別業態の名前は除外
      if (category === "izakaya" && IZAKAYA_NAME_EXCLUDE.test(name)) continue;
      const lat = typeof el.lat === "number" ? el.lat : el.center && el.center.lat;
      const lng = typeof el.lon === "number" ? el.lon : el.center && el.center.lon;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        category,
        lat,
        lng,
        tags: { cuisine: tags.cuisine || null, opening_hours: tags.opening_hours || null }
      });
    }
    return out;
  }

  // ブラウザから直接Overpassへ問い合わせる（ユーザーのネットワークで取得）
  // 各ミラーに個別タイムアウトを設け、失敗したら次のミラーへ進む。
  async function queryOverpassDirect(lat, lng, category, myId) {
    const tag = OVERPASS_TAGS[category];
    if (!tag) return [];
    const q =
      "[out:json][timeout:20];(" +
      "node" + tag + "(around:" + SEARCH_RADIUS_M + "," + lat + "," + lng + ");" +
      "way" + tag + "(around:" + SEARCH_RADIUS_M + "," + lat + "," + lng + ");" +
      ");out center tags 40;";
    let lastErr = null;
    for (const ep of OVERPASS_ENDPOINTS) {
      if (myId !== requestSeq) throw supersededError(); // 古い取得は破棄
      const ctrl = new AbortController();
      inflightAbort = ctrl;
      const timer = setTimeout(() => {
        try {
          ctrl.abort();
        } catch (e) {
          // 中断失敗は無視
        }
      }, PER_MIRROR_TIMEOUT_MS);
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(q),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const raw = await res.json();
        return parseOverpass(raw, category);
      } catch (err) {
        clearTimeout(timer);
        // 新しい取得に置き換わっていたら中断として扱う
        if (myId !== requestSeq) throw supersededError();
        lastErr = err; // タイムアウト/失敗は次のミラーへ
      }
    }
    throw lastErr || new Error("overpass unreachable");
  }

  // スポットを取得して描画する（ブラウザから直接Overpassを叩く＝ユーザーのネットワークで取得）
  async function fetchSpots(lat, lng, category) {
    const myId = ++requestSeq;
    // 進行中の取得を中断
    if (inflightAbort) {
      try {
        inflightAbort.abort();
      } catch (e) {
        // 中断失敗は無視
      }
    }

    list.innerHTML = "";
    clearMarkers();
    setStatus(MSG_LOADING, false, true);

    try {
      const spots = await queryOverpassDirect(lat, lng, category, myId);
      if (myId !== requestSeq) return; // 後続取得に置換済み
      inflightAbort = null;
      if (!spots || spots.length === 0) {
        setStatus(MSG_EMPTY, false, false);
        return;
      }
      setStatus(spots.length + (E.t("spots.countSuffix", "件") || "件"), false, false);
      spots.forEach(renderSpot);
    } catch (error) {
      if (myId !== requestSeq) return; // 中断/置換は無視
      inflightAbort = null;
      if (error && error.name === "AbortError") return;
      console.error("[nearbySpots] スポット取得に失敗しました:", error);
      list.innerHTML = "";
      clearMarkers();
      setStatus(MSG_ERROR, true, false);
    }
  }

  // ------------------------------------------------------------------
  // イベント購読
  // ------------------------------------------------------------------

  // 駅が変わったらリストとマーカーをクリアし初期状態へ戻す
  if (typeof E.on === "function") {
    E.on("select", () => {
      resetView(MSG_PICK, false);
    });
    // 再算出で候補が入れ替わった場合も初期状態へ戻す
    E.on("result", () => {
      resetView(MSG_PICK, false);
    });
  }
})();
