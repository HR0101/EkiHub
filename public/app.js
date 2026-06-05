// ===== EkiHub フロントエンド制御 =====
// 役割: 駅入力フォーム / オートコンプリート / モード切替 / API呼び出し / 地図描画

(() => {
  "use strict";

  // ----- 定数 -----
  const MIN_INPUTS = 2; // 最低入力駅数
  const DEFAULT_CENTER = [35.681382, 139.766084]; // 初期表示中心（東京駅）
  const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"; // ダーク地図タイル
  const TILE_ATTR =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  // ----- 状態 -----
  let allStations = []; // 駅マスタ（オートコンプリート用）
  let currentMode = "A"; // 既定は主要駅限定
  let map = null;
  let markerLayer = null; // マーカー・線をまとめて消すためのレイヤ
  let inputCounter = 0;
  let lastData = null; // 直近の算出結果（候補切替で再利用）
  let selectedName = null; // 現在カードに表示中の駅名

  // ----- DOM参照 -----
  const inputsBox = document.getElementById("stationInputs");
  const addBtn = document.getElementById("addStationBtn");
  const form = document.getElementById("stationForm");
  const submitBtn = document.getElementById("submitBtn");
  const errorBox = document.getElementById("formError");
  const modeToggle = document.getElementById("modeToggle");
  const toggleSlider = document.getElementById("toggleSlider");
  const weightSlider = document.getElementById("weightSlider");
  const weightHint = document.getElementById("weightHint");

  // ====================================================================
  // 初期化
  // ====================================================================
  async function init() {
    initMap();
    bindEvents();
    // 初期は2行（最低入力数）を生成
    addInputRow();
    addInputRow();
    await loadStationMaster();
  }

  // 地図を初期化する
  function initMap() {
    map = L.map("map", {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  // 駅マスタを取得する（オートコンプリートに利用）
  async function loadStationMaster() {
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error("駅データ取得に失敗");
      const data = await res.json();
      allStations = data.stations || [];
    } catch (error) {
      // 取得失敗してもフォーム自体は動作させる（サーバー側で名前検証する）
      console.error(error);
    }
  }

  // イベント登録
  function bindEvents() {
    addBtn.addEventListener("click", () => addInputRow(true));
    form.addEventListener("submit", onSubmit);

    // モードトグル
    modeToggle.querySelectorAll(".toggle__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setMode(btn.dataset.mode);
        rerunIfPossible();
      });
    });

    // 重視ポイント スライダー
    weightSlider.addEventListener("input", updateWeightHint); // ドラッグ中はラベルのみ更新
    weightSlider.addEventListener("change", rerunIfPossible); // 離した時に再計算
    updateWeightHint();

    // 入力欄外クリックで候補を閉じる
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".input-row__field")) {
        closeAllSuggests();
      }
    });
  }

  // ====================================================================
  // 入力行の管理
  // ====================================================================
  function addInputRow(focus = false) {
    inputCounter += 1;
    const row = document.createElement("div");
    row.className = "input-row";

    const indexBadge = document.createElement("span");
    indexBadge.className = "input-row__index";

    const field = document.createElement("div");
    field.className = "input-row__field";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "例）新宿、横浜、大宮…";
    input.setAttribute("aria-label", "最寄駅");

    const suggest = document.createElement("div");
    suggest.className = "suggest";

    field.appendChild(input);
    field.appendChild(suggest);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "input-row__remove";
    removeBtn.innerHTML = "×";
    removeBtn.title = "この駅を削除";
    removeBtn.addEventListener("click", () => removeInputRow(row));

    row.appendChild(indexBadge);
    row.appendChild(field);
    row.appendChild(removeBtn);
    inputsBox.appendChild(row);

    // オートコンプリート挙動を付与
    attachAutocomplete(input, suggest);

    renumberRows();
    if (focus) input.focus();
  }

  function removeInputRow(row) {
    const rows = inputsBox.querySelectorAll(".input-row");
    if (rows.length <= MIN_INPUTS) {
      flashError(`最低${MIN_INPUTS}駅は必要です.`);
      return;
    }
    row.style.opacity = "0";
    row.style.transform = "translateX(-12px)";
    setTimeout(() => {
      row.remove();
      renumberRows();
    }, 180);
  }

  // 行番号を振り直す
  function renumberRows() {
    inputsBox.querySelectorAll(".input-row").forEach((row, i) => {
      row.querySelector(".input-row__index").textContent = String(i + 1);
    });
  }

  // ====================================================================
  // オートコンプリート
  // ====================================================================
  function attachAutocomplete(input, suggest) {
    let activeIndex = -1;

    input.addEventListener("input", () => {
      const q = input.value.trim();
      input.classList.remove("is-valid", "is-invalid");
      activeIndex = -1;
      if (q.length === 0) {
        suggest.classList.remove("is-open");
        return;
      }
      const matches = searchStations(q).slice(0, 8);
      renderSuggest(suggest, matches, input);
    });

    // キーボード操作（上下選択・Enter確定）
    input.addEventListener("keydown", (e) => {
      const items = suggest.querySelectorAll(".suggest__item");
      if (!suggest.classList.contains("is-open") || items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        highlightSuggest(items, activeIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        highlightSuggest(items, activeIndex);
      } else if (e.key === "Enter") {
        if (activeIndex >= 0) {
          e.preventDefault();
          items[activeIndex].click();
        }
      } else if (e.key === "Escape") {
        suggest.classList.remove("is-open");
      }
    });

    // フォーカス喪失時に妥当性を確認
    input.addEventListener("blur", () => {
      setTimeout(() => validateInput(input), 150);
    });
  }

  // 部分一致で駅を検索する（駅名・読みの両方）
  function searchStations(query) {
    const q = query.toLowerCase();
    return allStations.filter(
      (s) => s.name.includes(query) || (s.kana && s.kana.toLowerCase().includes(q))
    );
  }

  function renderSuggest(suggest, matches, input) {
    suggest.innerHTML = "";
    if (matches.length === 0) {
      suggest.classList.remove("is-open");
      return;
    }
    matches.forEach((s) => {
      const item = document.createElement("div");
      item.className = "suggest__item";
      const tag = s.isMajor ? " ★" : "";
      item.innerHTML = `<span>${s.name}${tag}</span><span class="suggest__kana">${s.kana || ""}</span>`;
      item.addEventListener("click", () => {
        input.value = s.name;
        suggest.classList.remove("is-open");
        validateInput(input);
      });
      suggest.appendChild(item);
    });
    suggest.classList.add("is-open");
  }

  function highlightSuggest(items, index) {
    items.forEach((it, i) => it.classList.toggle("is-active", i === index));
    if (items[index]) items[index].scrollIntoView({ block: "nearest" });
  }

  function closeAllSuggests() {
    document.querySelectorAll(".suggest").forEach((s) => s.classList.remove("is-open"));
  }

  // 入力が実在駅かを検証して見た目に反映する
  function validateInput(input) {
    const v = input.value.trim();
    if (v.length === 0) {
      input.classList.remove("is-valid", "is-invalid");
      return false;
    }
    const exists = allStations.some((s) => s.name === v);
    input.classList.toggle("is-valid", exists);
    input.classList.toggle("is-invalid", !exists);
    return exists;
  }

  // ====================================================================
  // モード切替
  // ====================================================================
  function setMode(mode) {
    currentMode = mode === "A" ? "A" : "B";
    modeToggle.querySelectorAll(".toggle__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === currentMode);
    });
    toggleSlider.classList.toggle("is-right", currentMode === "B");
  }

  // スライダー値(0-100)を公平さ重み(0.0-1.0)へ変換する
  function getFairnessWeight() {
    return Number(weightSlider.value) / 100;
  }

  // スライダー位置に応じてヒント文言を更新する
  function updateWeightHint() {
    const v = Number(weightSlider.value);
    let label;
    if (v <= 20) label = "近さ最優先";
    else if (v <= 40) label = "やや近さ重視";
    else if (v < 60) label = "バランス";
    else if (v === 60) label = "バランス";
    else if (v <= 80) label = "やや公平さ重視";
    else label = "公平さ最優先";
    weightHint.textContent = label;
  }

  // 既に結果が表示されている場合、現在の入力で自動的に再計算する
  // （設定を触ると裏で再実行され、結果へ即反映される自然な操作感）
  function rerunIfPossible() {
    if (!lastData) return;
    onSubmit(new Event("submit"));
  }

  // ====================================================================
  // 送信・算出
  // ====================================================================
  async function onSubmit(e) {
    e.preventDefault();
    clearError();

    // 入力値を収集
    const inputs = Array.from(inputsBox.querySelectorAll("input"));
    const origins = inputs.map((i) => i.value.trim()).filter((v) => v.length > 0);

    if (origins.length < MIN_INPUTS) {
      flashError(`最寄駅を${MIN_INPUTS}駅以上入力してください.`);
      return;
    }
    // 重複チェック
    const unique = new Set(origins);
    if (unique.size < origins.length) {
      flashError("同じ駅が重複しています.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origins, mode: currentMode, weight: getFairnessWeight() })
      });
      const data = await res.json();
      if (!res.ok) {
        flashError(data.error || "算出に失敗しました.");
        return;
      }
      renderResult(data);
    } catch (error) {
      flashError("通信エラーが発生しました: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtn.querySelector(".btn__label").textContent = isLoading
      ? "算出中…"
      : "中心駅を算出する";
  }

  // ====================================================================
  // 結果表示
  // ====================================================================
  function renderResult(data) {
    lastData = data;
    // 初期表示は最良候補（ランキング1位）を選択状態にする
    selectCandidate(data.best, false);
    // 結果へスムーズスクロール（モバイル配慮）
    document.getElementById("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 指定した候補駅をカード・所要時間・地図へ反映する（ランキングからの切替にも使用）
  function selectCandidate(station, doScroll = true) {
    if (!station || !lastData) return;
    selectedName = station.name;

    // 中心駅カード
    const card = document.getElementById("resultCard");
    card.classList.remove("is-empty");
    card.querySelector(".result-card__content").hidden = false;

    // 1位かどうかで見出しを出し分ける
    const isTop = lastData.best && lastData.best.name === station.name;
    document.querySelector(".result-card__eyebrow").textContent = isTop
      ? "提案された中心駅"
      : "選択中の候補駅";

    document.getElementById("bestName").textContent = station.name;
    document.getElementById("bestKana").textContent =
      (station.kana || "") +
      (station.isMajor ? " ・主要ターミナル駅" : "") +
      (station.ridership ? ` ・乗降 約${Math.round(station.ridership / 10000)}万人/日` : "");

    const linesBox = document.getElementById("bestLines");
    linesBox.innerHTML = "";
    (station.lines || []).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      linesBox.appendChild(li);
    });

    document.getElementById("bestAvg").textContent = station.averageMinutes;
    document.getElementById("bestFairness").textContent = "±" + station.fairness;
    document.getElementById("bestDist").textContent = station.distanceToCentroidKm;

    // 各駅からの所要時間バー（選択駅基準）
    renderTravelList(station.travelTimes);

    // ランキング（選択中をハイライト）
    renderRanking(lastData.ranking);

    // 地図描画（選択駅を中心マーカーにする）
    renderMap(lastData, station);

    if (doScroll) {
      document.getElementById("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderTravelList(travelTimes) {
    const box = document.getElementById("travelList");
    const list = document.getElementById("travelItems");
    list.innerHTML = "";
    box.hidden = false;

    const maxMin = Math.max(...travelTimes.map((t) => t.minutes), 1);
    travelTimes.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "travel-item";
      li.style.animationDelay = `${i * 0.05}s`;
      li.innerHTML = `
        <span class="travel-item__name">${t.from}</span>
        <span class="travel-item__bar"><span class="travel-item__fill"></span></span>
        <span class="travel-item__min">${t.minutes}分</span>`;
      list.appendChild(li);
      // バー幅をアニメーションさせる
      const fill = li.querySelector(".travel-item__fill");
      requestAnimationFrame(() => {
        fill.style.width = `${(t.minutes / maxMin) * 100}%`;
      });
    });
  }

  function renderRanking(ranking) {
    const box = document.getElementById("rankingBox");
    const list = document.getElementById("rankingItems");
    list.innerHTML = "";
    if (!ranking || ranking.length <= 1) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    // 全候補を順位つきで表示し、選択中の駅をハイライトする
    ranking.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "ranking-item";
      if (r.name === selectedName) li.classList.add("is-selected");
      li.innerHTML = `
        <span class="ranking-item__rank">${i + 1}</span>
        <span class="ranking-item__name">${r.name}</span>
        <span class="ranking-item__meta">平均${r.averageMinutes}分 / ±${r.fairness} / ${r.distanceToCentroidKm}km</span>`;
      // クリックでこの候補の詳細へ切り替える
      li.addEventListener("click", () => selectCandidate(r));
      list.appendChild(li);
    });
  }

  // 地図に入力駅・中心駅・関係線を描画する
  // selected: 中心マーカーとして強調する駅（未指定時は最良候補）
  function renderMap(data, selected) {
    const center = selected || data.best;
    markerLayer.clearLayers();
    const bounds = [];

    // 入力駅マーカー
    data.origins.forEach((o, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin pin--origin">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker([o.lat, o.lng], { icon })
        .addTo(markerLayer)
        .bindPopup(`<b>${o.name}</b><br>最寄駅 ${i + 1}`);
      bounds.push([o.lat, o.lng]);

      // 選択駅への関係線
      L.polyline(
        [
          [o.lat, o.lng],
          [center.lat, center.lng]
        ],
        { color: "#5e7bff", weight: 1.5, opacity: 0.4, dashArray: "4 6" }
      ).addTo(markerLayer);
    });

    // 中心（選択）駅マーカー
    const isTop = data.best && data.best.name === center.name;
    const centerIcon = L.divIcon({
      className: "",
      html: `<div class="pin pin--center">${isTop ? "中心" : "候補"}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([center.lat, center.lng], { icon: centerIcon })
      .addTo(markerLayer)
      .bindPopup(`<b>${center.name}</b><br>${isTop ? "提案された中心駅" : "選択中の候補駅"}`)
      .openPopup();
    bounds.push([center.lat, center.lng]);

    // 重心位置（参考の小マーカー）
    L.circleMarker([data.centroid.lat, data.centroid.lng], {
      radius: 5,
      color: "#9d6bff",
      fillColor: "#9d6bff",
      fillOpacity: 0.6,
      weight: 1
    })
      .addTo(markerLayer)
      .bindPopup("入力駅の地理的重心");
    bounds.push([data.centroid.lat, data.centroid.lng]);

    // 全マーカーが収まるよう地図をフィット
    map.flyToBounds(bounds, { padding: [50, 50], duration: 0.9, maxZoom: 14 });
  }

  // ====================================================================
  // エラー表示ユーティリティ
  // ====================================================================
  function flashError(message) {
    errorBox.textContent = message;
  }

  function clearError() {
    errorBox.textContent = "";
  }

  // 起動
  init();
})();
