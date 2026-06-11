// ===== EkiHub フロントエンド コア =====
// 役割: 駅入力フォーム / オートコンプリート / モード・重み / API呼び出し / 地図描画
//       および 機能モジュール用の拡張API (window.EkiHub)
//
// 機能モジュール(public/js/features/*.js)は window.EkiHub を介して
// 状態の購読・DOM拡張・地図操作を行う. コアは既存UIの描画に専念する.

(() => {
  "use strict";

  // ====================================================================
  // 拡張API: window.EkiHub（イベントバス＋アクセサ＋ヘルパー）
  // ====================================================================
  const subscribers = {}; // event -> [fn]
  const injectedStyles = new Set();

  const EkiHub = {
    version: "2.0",

    // ----- 状態（読み取り用。書き換えは専用メソッド経由） -----
    state: {
      lastData: null,
      selectedName: null,
      currentMode: "A",
      fairnessWeight: 0.6, // 0..1
      fareWeight: 0, // 0..1
      meetingTime: null // "YYYY-MM-DDTHH:mm" など
    },

    // ----- pub/sub -----
    on(event, fn) {
      (subscribers[event] ||= []).push(fn);
      return () => EkiHub.off(event, fn);
    },
    off(event, fn) {
      const list = subscribers[event];
      if (list) subscribers[event] = list.filter((f) => f !== fn);
    },
    emit(event, payload) {
      (subscribers[event] || []).forEach((fn) => {
        try {
          fn(payload);
        } catch (error) {
          console.error(`[EkiHub] ${event} ハンドラでエラー:`, error);
        }
      });
    },

    // ----- アクセサ -----
    getStations: () => allStations,
    getState: () => ({ ...EkiHub.state }),
    getResult: () => EkiHub.state.lastData,
    getSelected: () => {
      const d = EkiHub.state.lastData;
      if (!d) return null;
      return d.ranking.find((r) => r.name === EkiHub.state.selectedName) || d.best;
    },
    getInputs: () => readInputRows(),
    getOrigins: () => readInputRows().map((r) => r.name).filter(Boolean),
    getMeetingTime: () => EkiHub.state.meetingTime,

    // ----- 状態変更（再計算をともなう操作） -----
    setOrigins: (list, options = {}) => setOrigins(list, options),
    setFareWeight: (v) => {
      EkiHub.state.fareWeight = Math.min(1, Math.max(0, Number(v) || 0));
      EkiHub.emit("fareweight-change", EkiHub.state.fareWeight);
      if (EkiHub.state.lastData) rerunIfPossible();
    },
    setMeetingTime: (str) => {
      EkiHub.state.meetingTime = str || null;
      EkiHub.emit("meeting-change", EkiHub.state.meetingTime);
    },
    compute: () => onSubmit(new Event("submit")),
    selectByName: (name) => {
      const d = EkiHub.state.lastData;
      if (!d) return;
      const r = d.ranking.find((x) => x.name === name);
      if (r) selectCandidate(r);
    },

    // ----- 地図 -----
    get map() {
      return map;
    },
    get featureLayer() {
      return featureLayer;
    },
    flyTo: (lat, lng, zoom = 14) => {
      if (map) map.flyTo([lat, lng], zoom, { duration: 0.7 });
    },

    // ----- ヘルパー -----
    haversine: haversineMeters,
    nearestStation: (lat, lng) => nearestStation(lat, lng),
    escapeHtml,
    formatYen: (n) => (n > 0 ? "¥" + Number(n).toLocaleString("ja-JP") : "—"),
    formatMinutes: (n) => `${n}分`,
    injectStyle: (id, css) => {
      if (injectedStyles.has(id)) return;
      injectedStyles.add(id);
      const style = document.createElement("style");
      style.dataset.feature = id;
      style.textContent = css;
      document.head.appendChild(style);
    },
    // i18n: 既定は日本語をそのまま返す。i18nモジュールが差し替える.
    t: (_key, fallback) => fallback
  };
  window.EkiHub = EkiHub;

  // ====================================================================
  // 定数
  // ====================================================================
  const MIN_INPUTS = 2;
  const DEFAULT_CENTER = [35.681382, 139.766084];
  const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const TILE_ATTR =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const EARTH_RADIUS_M = 6371000;

  // ====================================================================
  // 状態
  // ====================================================================
  let allStations = [];
  let currentMode = "A";
  let map = null;
  let markerLayer = null; // コアの描画用（毎回クリア）
  let featureLayer = null; // 機能モジュール用（各自管理）
  let lastData = null;
  let selectedName = null;
  let labelByStation = {}; // 駅名 -> メンバー名ラベル

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
    addInputRow();
    addInputRow();
    await loadStationMaster();
    // 駅マスタ取得完了を通知（機能モジュールはここから動き出す）
    EkiHub.emit("ready", { stations: allStations });
    // URL共有パラメータがあれば反映して自動算出
    applyShareParams();
  }

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

    // 鉄道路線オーバーレイ（OpenRailwayMap）。線路・路線がマップ上に表示される。
    // 無料・キー不要。ベース地図の上に重ねて、駅間の経路が線路として見えるようにする。
    const railLayer = L.tileLayer(
      "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png",
      {
        attribution: '鉄道: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>',
        subdomains: "abc",
        maxZoom: 19,
        opacity: 0.85
      }
    ).addTo(map); // 既定で表示

    // レイヤ切替（鉄道路線のオン/オフ）
    L.control
      .layers(null, { "鉄道路線": railLayer }, { collapsed: false })
      .addTo(map);

    markerLayer = L.layerGroup().addTo(map);
    featureLayer = L.layerGroup().addTo(map);
  }

  async function loadStationMaster() {
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error("駅データ取得に失敗");
      const data = await res.json();
      allStations = data.stations || [];
    } catch (error) {
      console.error(error);
    }
  }

  function bindEvents() {
    addBtn.addEventListener("click", () => addInputRow(true));
    form.addEventListener("submit", onSubmit);

    modeToggle.querySelectorAll(".toggle__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setMode(btn.dataset.mode);
        rerunIfPossible();
      });
    });

    weightSlider.addEventListener("input", updateWeightHint);
    weightSlider.addEventListener("change", rerunIfPossible);
    updateWeightHint();

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".input-row__field")) closeAllSuggests();
    });
  }

  // ====================================================================
  // 入力行（メンバー名ラベル＋人数つき）
  // ====================================================================
  function addInputRow(focus = false, preset = null) {
    const row = document.createElement("div");
    row.className = "input-row";

    const indexBadge = document.createElement("span");
    indexBadge.className = "input-row__index";

    // 駅名フィールド＋オートコンプリート
    const field = document.createElement("div");
    field.className = "input-row__field";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "js-station";
    input.placeholder = "例）新宿、横浜、大宮…";
    input.setAttribute("aria-label", "最寄駅");
    const suggest = document.createElement("div");
    suggest.className = "suggest";
    field.appendChild(input);
    field.appendChild(suggest);

    // 人数（重み）
    const peopleInput = document.createElement("input");
    peopleInput.type = "number";
    peopleInput.className = "input-row__people js-people";
    peopleInput.min = "1";
    peopleInput.max = "99";
    peopleInput.value = "1";
    peopleInput.title = "この駅から来る人数";
    peopleInput.setAttribute("aria-label", "人数");

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "input-row__remove";
    removeBtn.innerHTML = "×";
    removeBtn.title = "この駅を削除";
    removeBtn.addEventListener("click", () => removeInputRow(row));

    row.appendChild(indexBadge);
    row.appendChild(field);
    row.appendChild(peopleInput);
    row.appendChild(removeBtn);
    inputsBox.appendChild(row);

    attachAutocomplete(input, suggest);
    // 入力変化を通知（共有URL等が追従）
    [input, peopleInput].forEach((el) =>
      el.addEventListener("change", () => EkiHub.emit("inputs-change", readInputRows()))
    );

    if (preset) {
      if (preset.name) input.value = preset.name;
      if (preset.people) peopleInput.value = String(preset.people);
      validateInput(input);
    }

    renumberRows();
    if (focus) input.focus();
    return row;
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
      EkiHub.emit("inputs-change", readInputRows());
    }, 180);
  }

  function renumberRows() {
    inputsBox.querySelectorAll(".input-row").forEach((row, i) => {
      row.querySelector(".input-row__index").textContent = String(i + 1);
    });
  }

  // 現在の入力行を読み取る
  function readInputRows() {
    return Array.from(inputsBox.querySelectorAll(".input-row")).map((row) => {
      const name = row.querySelector(".js-station").value.trim();
      const label = ""; // メンバー名ラベルは廃止（下流互換のため空文字を返す）
      const peopleRaw = parseInt(row.querySelector(".js-people").value, 10);
      const people = Number.isFinite(peopleRaw) && peopleRaw > 0 ? peopleRaw : 1;
      return { name, label, people };
    });
  }

  // 入力行を指定リストで置き換える
  function setOrigins(list, options = {}) {
    if (!Array.isArray(list) || list.length === 0) return;
    inputsBox.innerHTML = "";
    list.forEach((item) => {
      const preset =
        typeof item === "string" ? { name: item } : { name: item.name, label: item.label, people: item.people };
      addInputRow(false, preset);
    });
    while (inputsBox.querySelectorAll(".input-row").length < MIN_INPUTS) addInputRow();
    EkiHub.emit("inputs-change", readInputRows());
    if (options.compute) onSubmit(new Event("submit"));
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
      const matches = searchStations(q);
      renderSuggest(suggest, matches, input, q);
    });

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

    input.addEventListener("blur", () => {
      setTimeout(() => validateInput(input), 150);
    });
  }

  // ===== 入力補完ヘルパー =====

  // ローマ字→ひらがな変換テーブル（ワープロローマ字）
  const ROMAJI_TO_HIRAGANA = {
    'a':'あ','i':'い','u':'う','e':'え','o':'お',
    'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
    'sa':'さ','shi':'し','si':'し','su':'す','se':'せ','so':'そ',
    'ta':'た','chi':'ち','ti':'ち','tsu':'つ','tu':'つ','te':'て','to':'と',
    'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
    'ha':'は','hi':'ひ','fu':'ふ','hu':'ふ','he':'へ','ho':'ほ',
    'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
    'ya':'や','yu':'ゆ','yo':'よ',
    'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
    'wa':'わ','wo':'を','n':'ん',
    'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
    'za':'ざ','ji':'じ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
    'da':'だ','de':'で','do':'ど',
    'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
    'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
    'kya':'きゃ','kyu':'きゅ','kyo':'きょ',
    'sha':'しゃ','shu':'しゅ','sho':'しょ',
    'cha':'ちゃ','chu':'ちゅ','cho':'ちょ',
    'tya':'ちゃ','tyu':'ちゅ','tyo':'ちょ',
    'nya':'にゃ','nyu':'にゅ','nyo':'にょ',
    'hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ',
    'mya':'みゃ','myu':'みゅ','myo':'みょ',
    'rya':'りゃ','ryu':'りゅ','ryo':'りょ',
    'gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ',
    'ja':'じゃ','ju':'じゅ','jo':'じょ',
    'bya':'びゃ','byu':'びゅ','byo':'びょ',
    'pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ',
  };

  // カタカナ→ひらがな（比較時の正規化に使用）
  function katakanaToHiragana(str) {
    return str.replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  // ローマ字→ひらがな（変換できない文字はそのまま残す）
  function romajiToHiragana(str) {
    let result = '';
    let i = 0;
    const s = str.toLowerCase();
    while (i < s.length) {
      // 重子音（tt/kk など）→ っ
      if (
        i + 1 < s.length &&
        s[i] !== 'n' &&
        s[i] === s[i + 1] &&
        /[bcdfghjklmnpqrstvwxyz]/.test(s[i])
      ) {
        result += 'っ';
        i++;
        continue;
      }
      let matched = false;
      for (let len = Math.min(3, s.length - i); len >= 1; len--) {
        const chunk = s.slice(i, i + len);
        if (ROMAJI_TO_HIRAGANA[chunk]) {
          result += ROMAJI_TO_HIRAGANA[chunk];
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) { result += s[i]; i++; }
    }
    return result;
  }

  // クエリが日本語かなかどうかを判定する
  const KANA_RE = /^[ぁ-んァ-ヶー]+$/;

  // 駅のスコアを計算する（前方一致 > 部分一致、乗降客数で tie-break）
  function scoreStation(s, query) {
    const name = s.name;
    const kana = katakanaToHiragana((s.kana || '').toLowerCase());
    const qLower = query.toLowerCase();
    const qHira = katakanaToHiragana(qLower);
    const qFromRomaji = romajiToHiragana(qLower);

    let score = 0;

    // 駅名マッチ
    if (name === query) score += 1000;
    else if (name.startsWith(query)) score += 500;
    else if (name.includes(query)) score += 200;

    // かなマッチ（ひらがな統一）
    if (kana === qHira) score += 900;
    else if (kana.startsWith(qHira)) score += 400;
    else if (kana.includes(qHira)) score += 150;

    // ローマ字変換後のかなマッチ（実際に変換された場合のみ）
    if (qFromRomaji !== qLower) {
      if (kana === qFromRomaji) score += 850;
      else if (kana.startsWith(qFromRomaji)) score += 350;
      else if (kana.includes(qFromRomaji)) score += 120;
    }

    if (score === 0) return 0;

    // 乗降客数・主要駅ボーナス（スコアが近い場合の tie-break）
    if (s.ridership) score += Math.min(Math.floor(Math.log10(s.ridership) * 8), 80);
    if (s.isMajor) score += 20;

    return score;
  }

  function searchStations(query) {
    const q = query.trim();
    if (!q) return [];
    const scored = [];
    for (const s of allStations) {
      const sc = scoreStation(s, q);
      if (sc > 0) scored.push({ station: s, score: sc });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 10).map((x) => x.station);
  }

  // 駅名のマッチ部分を <mark> でハイライトして返す
  function highlightMatch(name, query) {
    if (!query) return escapeHtml(name);
    const idx = name.indexOf(query);
    if (idx === -1) return escapeHtml(name);
    return (
      escapeHtml(name.slice(0, idx)) +
      '<mark class="suggest__hl">' + escapeHtml(query) + '</mark>' +
      escapeHtml(name.slice(idx + query.length))
    );
  }

  function renderSuggest(suggest, matches, input, query) {
    suggest.innerHTML = "";
    if (matches.length === 0) {
      suggest.classList.remove("is-open");
      return;
    }
    matches.forEach((s) => {
      const item = document.createElement("div");
      item.className = "suggest__item";

      const nameHtml = highlightMatch(s.name, query);
      const majorHtml = s.isMajor
        ? '<span class="suggest__major">★</span>'
        : '';
      const lines = (s.lines || []).slice(0, 2);
      const linesHtml = lines.length
        ? `<div class="suggest__sub">${lines.map((l) => escapeHtml(l)).join('<span class="suggest__dot"> · </span>')}</div>`
        : '';

      item.innerHTML = `
        <div class="suggest__main">
          <span class="suggest__name">${nameHtml}${majorHtml}</span>
          <span class="suggest__kana">${escapeHtml(s.kana || '')}</span>
        </div>
        ${linesHtml}`;

      item.addEventListener("click", () => {
        input.value = s.name;
        suggest.classList.remove("is-open");
        validateInput(input);
        EkiHub.emit("inputs-change", readInputRows());
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
  // モード・重み
  // ====================================================================
  function setMode(mode) {
    currentMode = mode === "A" ? "A" : "B";
    EkiHub.state.currentMode = currentMode;
    modeToggle.querySelectorAll(".toggle__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === currentMode);
    });
    toggleSlider.classList.toggle("is-right", currentMode === "B");
  }

  function getFairnessWeight() {
    return Number(weightSlider.value) / 100;
  }

  function updateWeightHint() {
    const v = Number(weightSlider.value);
    let label;
    if (v <= 20) label = "近さ最優先";
    else if (v <= 40) label = "やや近さ重視";
    else if (v <= 60) label = "バランス";
    else if (v <= 80) label = "やや公平さ重視";
    else label = "公平さ最優先";
    weightHint.textContent = label;
    EkiHub.state.fairnessWeight = getFairnessWeight();
  }

  function rerunIfPossible() {
    if (!lastData) return;
    onSubmit(new Event("submit"));
  }

  // ====================================================================
  // 送信・算出
  // ====================================================================
  async function onSubmit(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    clearError();

    const rows = readInputRows();
    const origins = rows.map((r) => r.name).filter((v) => v.length > 0);

    if (origins.length < MIN_INPUTS) {
      flashError(`最寄駅を${MIN_INPUTS}駅以上入力してください.`);
      return;
    }
    const unique = new Set(origins);
    if (unique.size < origins.length) {
      flashError("同じ駅が重複しています.");
      return;
    }

    // 駅名→ラベル のマップ（結果表示・共有で使用）
    labelByStation = {};
    const peopleCounts = [];
    rows.forEach((r) => {
      if (r.name) {
        if (r.label) labelByStation[r.name] = r.label;
        peopleCounts.push(r.people);
      }
    });

    setLoading(true);
    try {
      const res = await fetch("/api/center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origins,
          mode: currentMode,
          weight: getFairnessWeight(),
          fareWeight: EkiHub.state.fareWeight,
          peopleCounts
        })
      });
      const data = await res.json();
      if (!res.ok) {
        flashError(data.error || "算出に失敗しました.");
        return;
      }
      data.labels = labelByStation; // ラベルを結果へ添付
      renderResult(data);
    } catch (error) {
      flashError("通信エラーが発生しました: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // ローディング表示の最小時間(ms)。一瞬で終わっても点滅させずに見せる.
  const LOADING_MIN_MS = 550;
  let loadingShownAt = 0;
  let loadingHideTimer = null;

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("is-loading", isLoading);
    // i18nモジュールがあれば現在言語のラベルを尊重する
    const idleLabel = EkiHub.t("compute", "中心駅を算出する");
    const busyLabel = EkiHub.t("computing", "算出中…");
    submitBtn.querySelector(".btn__label").textContent = isLoading ? busyLabel : idleLabel;

    // 可愛いローディングオーバーレイの表示制御
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    if (isLoading) {
      if (loadingHideTimer) {
        clearTimeout(loadingHideTimer);
        loadingHideTimer = null;
      }
      loadingShownAt = performance.now();
      overlay.hidden = false;
    } else {
      // 最小表示時間を満たすまで隠さない（一瞬の点滅を防ぐ）
      const elapsed = performance.now() - loadingShownAt;
      const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
      if (loadingHideTimer) clearTimeout(loadingHideTimer);
      loadingHideTimer = setTimeout(() => {
        overlay.hidden = true;
        loadingHideTimer = null;
      }, remaining);
    }
  }

  // ====================================================================
  // 結果表示
  // ====================================================================
  function renderResult(data) {
    lastData = data;
    EkiHub.state.lastData = data;
    selectCandidate(data.best, false);
    document.getElementById("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
    EkiHub.emit("result", data);
  }

  // 駅名に対する表示名（メンバー名があれば併記）
  function displayFrom(stationName) {
    const label = (lastData && lastData.labels && lastData.labels[stationName]) || labelByStation[stationName];
    return label ? `${escapeHtml(label)}（${escapeHtml(stationName)}）` : escapeHtml(stationName);
  }

  function selectCandidate(station, doScroll = true) {
    if (!station || !lastData) return;
    selectedName = station.name;
    EkiHub.state.selectedName = station.name;

    const card = document.getElementById("resultCard");
    card.classList.remove("is-empty");
    card.querySelector(".result-card__content").hidden = false;

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

    // メトリクス（平均所要・ばらつき・重心距離・平均運賃）
    document.getElementById("bestAvg").textContent = station.averageMinutes;
    document.getElementById("bestFairness").textContent = "±" + station.fairness;
    document.getElementById("bestDist").textContent = station.distanceToCentroidKm;
    const fareEl = document.getElementById("bestFare");
    if (fareEl) fareEl.textContent = station.averageFareYen ? "¥" + station.averageFareYen.toLocaleString("ja-JP") : "—";

    // 所要時間の範囲（公平性の直感的表示）＋データ出典
    const rangeEl = document.getElementById("bestRange");
    if (rangeEl) {
      // データ出典の表示: 実経路(OTP) > 鉄道網ルート概算(グラフ) > 直線概算
      let source;
      if (lastData.routingRefined || station.routed) {
        source = "（実経路データ）";
      } else if (lastData.routingMethod === "graph") {
        source = "（鉄道網ルート概算）";
      } else {
        source = "（距離からの概算）";
      }
      const transfers =
        typeof station.averageTransfers === "number"
          ? ` ・平均乗換 ${station.averageTransfers}回`
          : "";
      rangeEl.textContent = `各メンバー ${station.minMinutes}〜${station.maxMinutes}分${transfers} ${source}`;
    }

    renderTravelList(station.travelTimes);
    renderRanking(lastData.ranking);
    renderMap(lastData, station);

    if (doScroll) {
      document.getElementById("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    EkiHub.emit("select", station);
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
      // 乗換回数（実経路データがある場合のみ表示）
      const transfer =
        typeof t.transfers === "number"
          ? `<span class="badge badge--transfer">乗換${t.transfers}回</span>`
          : "";
      const direct =
        t.directPossible && typeof t.transfers !== "number"
          ? '<span class="badge badge--direct">直通</span>'
          : "";
      const fare = t.fareYen ? `<span class="travel-item__fare">¥${t.fareYen.toLocaleString("ja-JP")}</span>` : "";
      li.innerHTML = `
        <span class="travel-item__name">${displayFrom(t.from)}</span>
        <span class="travel-item__bar"><span class="travel-item__fill"></span></span>
        ${fare}
        ${transfer}
        ${direct}
        <span class="travel-item__min">${t.minutes}分</span>`;
      list.appendChild(li);
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
    ranking.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = "ranking-item";
      if (r.name === selectedName) li.classList.add("is-selected");
      const fare = r.averageFareYen ? ` / ¥${r.averageFareYen.toLocaleString("ja-JP")}` : "";
      li.innerHTML = `
        <span class="ranking-item__rank">${i + 1}</span>
        <span class="ranking-item__name">${escapeHtml(r.name)}</span>
        <span class="ranking-item__meta">平均${r.averageMinutes}分 / ±${r.fairness}${fare}</span>`;
      li.addEventListener("click", () => selectCandidate(r));
      list.appendChild(li);
    });
  }

  function renderMap(data, selected) {
    const center = selected || data.best;
    markerLayer.clearLayers();
    const bounds = [];

    data.origins.forEach((o, i) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin pin--origin">${i + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const labelText = (data.labels && data.labels[o.name]) ? `${data.labels[o.name]}（${o.name}）` : o.name;
      L.marker([o.lat, o.lng], { icon })
        .addTo(markerLayer)
        .bindPopup(`<b>${escapeHtml(labelText)}</b><br>最寄駅 ${i + 1}${o.people > 1 ? " ・" + o.people + "人" : ""}`);
      bounds.push([o.lat, o.lng]);

      L.polyline(
        [
          [o.lat, o.lng],
          [center.lat, center.lng]
        ],
        { color: "#5e7bff", weight: 1.5, opacity: 0.4, dashArray: "4 6" }
      ).addTo(markerLayer);
    });

    const isTop = data.best && data.best.name === center.name;
    const centerIcon = L.divIcon({
      className: "",
      html: `<div class="pin pin--center">${isTop ? "中心" : "候補"}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([center.lat, center.lng], { icon: centerIcon })
      .addTo(markerLayer)
      .bindPopup(`<b>${escapeHtml(center.name)}</b><br>${isTop ? "提案された中心駅" : "選択中の候補駅"}`)
      .openPopup();
    bounds.push([center.lat, center.lng]);

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

    map.flyToBounds(bounds, { padding: [50, 50], duration: 0.9, maxZoom: 14 });
  }

  // ====================================================================
  // URL共有パラメータの反映
  //   ?o=新宿,横浜  &mode=A/B  &w=0-100  &fw=0-100
  //   &names=太郎,花子  &people=2,1  &t=2026-06-10T19:00
  // ====================================================================
  function applyShareParams() {
    const params = new URLSearchParams(location.search);
    const o = params.get("o");
    if (!o) return;
    const names = (o.split(",").map((s) => s.trim()).filter(Boolean));
    if (names.length < MIN_INPUTS) return;

    const labels = (params.get("names") || "").split(",");
    const peoples = (params.get("people") || "").split(",");
    const list = names.map((name, i) => ({
      name,
      label: (labels[i] || "").trim(),
      people: parseInt(peoples[i], 10) || 1
    }));

    const mode = params.get("mode");
    if (mode === "A" || mode === "B") setMode(mode);
    const w = parseInt(params.get("w"), 10);
    if (Number.isFinite(w)) {
      weightSlider.value = String(Math.min(100, Math.max(0, w)));
      updateWeightHint();
    }
    const fw = parseInt(params.get("fw"), 10);
    if (Number.isFinite(fw)) EkiHub.state.fareWeight = Math.min(1, Math.max(0, fw / 100));
    const t = params.get("t");
    if (t) EkiHub.setMeetingTime(t);

    setOrigins(list, { compute: true });
  }

  // ====================================================================
  // ヘルパー
  // ====================================================================
  function haversineMeters(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestStation(lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const s of allStations) {
      const d = haversineMeters(lat, lng, s.lat, s.lng);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best ? { ...best, distanceM: Math.round(bestDist) } : null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flashError(message) {
    errorBox.textContent = message;
  }

  function clearError() {
    errorBox.textContent = "";
  }

  // 起動
  init();
})();
