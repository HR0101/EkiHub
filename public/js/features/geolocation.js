// ====================================================================
// EkiHub 機能モジュール: 現在地から最寄駅
// 現在地(Geolocation)を取得し,最寄駅を入力欄へ挿入する.
// グローバル window.EkiHub を介してコアと連携する.
// ====================================================================
(() => {
  "use strict";

  // EkiHub コアが存在しない場合は何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 機能固有の定数
  const FEATURE_ID = "geoloc";
  const GEO_TIMEOUT_MS = 10000; // 位置取得のタイムアウト
  const MSG_DURATION_MS = 4000; // エラーメッセージ表示時間
  const BTN_LABEL = E.t("geoloc.button", "現在地から最寄駅");
  const BTN_LOADING = E.t("geoloc.loading", "取得中…");

  // メッセージ消去用タイマー
  let messageTimer = null;

  // ------------------------------------------------------------------
  // スタイル注入(機能固有クラス接頭辞 geoloc__ を使用)
  // ------------------------------------------------------------------
  E.injectStyle(
    FEATURE_ID,
    `
    .geoloc {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .geoloc__btn[disabled] {
      opacity: 0.6;
      cursor: progress;
    }
    .geoloc__btn .geoloc__spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 6px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      vertical-align: -1px;
      animation: geoloc-spin 0.8s linear infinite;
    }
    @keyframes geoloc-spin {
      to { transform: rotate(360deg); }
    }
    .geoloc__msg {
      font-size: 12px;
      line-height: 1.4;
      color: #b00020;
    }
    .geoloc__msg--ok {
      color: #0a7d2c;
    }
    `
  );

  // ------------------------------------------------------------------
  // DOM 構築
  // ------------------------------------------------------------------
  const host = document.getElementById("feature-controls");
  if (!host) return; // 拡張枠が無ければ何もしない

  // ラッパ(ボタン＋メッセージ)
  const wrap = document.createElement("div");
  wrap.className = "geoloc";

  // 現在地ボタン
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool-btn geoloc__btn";
  button.textContent = BTN_LABEL;

  // 一時メッセージ表示用の要素
  const message = document.createElement("span");
  message.className = "geoloc__msg";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  wrap.appendChild(button);
  wrap.appendChild(message);
  host.appendChild(wrap);

  // ------------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------------

  // 一時メッセージを表示する(数秒で自動消去)
  // isError=true で赤,false で緑
  function showMessage(text, isError) {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    message.textContent = text;
    message.classList.toggle("geoloc__msg--ok", !isError);
    messageTimer = setTimeout(() => {
      message.textContent = "";
      message.classList.remove("geoloc__msg--ok");
      messageTimer = null;
    }, MSG_DURATION_MS);
  }

  // ボタンのローディング状態を切り替える
  function setLoading(loading) {
    button.disabled = loading;
    if (loading) {
      button.innerHTML = "";
      const spinner = document.createElement("span");
      spinner.className = "geoloc__spinner";
      spinner.setAttribute("aria-hidden", "true");
      button.appendChild(spinner);
      button.appendChild(document.createTextNode(BTN_LOADING));
    } else {
      button.textContent = BTN_LABEL;
    }
  }

  // 入力配列へ最寄駅名を反映する
  // 最初に name が空の行へ入れる.空行が無ければ先頭行を上書きする.
  function applyNearestStation(stationName) {
    let rows = [];
    try {
      rows = E.getInputs();
    } catch (error) {
      console.error("[geoloc] 入力の取得に失敗しました:", error);
      rows = [];
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      // 入力行が取得できない場合は1行だけで適用
      rows = [{ name: stationName, label: "", people: 1 }];
    } else {
      // 既存配列をコピーして編集(元配列を破壊しない)
      rows = rows.map((row) => ({
        name: row && row.name ? row.name : "",
        label: row && row.label ? row.label : "",
        people: row && row.people ? row.people : 1,
      }));
      const emptyIndex = rows.findIndex((row) => !row.name);
      const targetIndex = emptyIndex >= 0 ? emptyIndex : 0;
      rows[targetIndex].name = stationName;
    }

    try {
      // compute はしない(入力反映のみ)
      E.setOrigins(rows);
    } catch (error) {
      console.error("[geoloc] 入力への反映に失敗しました:", error);
      showMessage(E.t("geoloc.applyError", "入力への反映に失敗しました。"), true);
    }
  }

  // 位置情報エラーをメッセージへ変換する
  function describeGeoError(error) {
    if (!error || typeof error.code !== "number") {
      return E.t("geoloc.errUnknown", "現在地を取得できませんでした。");
    }
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        return E.t("geoloc.errDenied", "位置情報の利用が許可されていません。");
      case 2: // POSITION_UNAVAILABLE
        return E.t("geoloc.errUnavailable", "現在地を取得できませんでした。");
      case 3: // TIMEOUT
        return E.t("geoloc.errTimeout", "現在地の取得がタイムアウトしました。");
      default:
        return E.t("geoloc.errUnknown", "現在地を取得できませんでした。");
    }
  }

  // ------------------------------------------------------------------
  // メイン処理: 現在地取得 → 最寄駅反映
  // ------------------------------------------------------------------
  function handleClick() {
    // Geolocation 非対応ブラウザ
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
      showMessage(E.t("geoloc.unsupported", "このブラウザは位置情報に対応していません。"), true);
      return;
    }

    setLoading(true);

    // 二重完了を防ぐためのフラグ
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      setLoading(false);
    };

    try {
      navigator.geolocation.getCurrentPosition(
        // 成功
        (position) => {
          finish();
          try {
            const lat = position && position.coords ? position.coords.latitude : null;
            const lng = position && position.coords ? position.coords.longitude : null;
            if (typeof lat !== "number" || typeof lng !== "number") {
              showMessage(E.t("geoloc.errUnknown", "現在地を取得できませんでした。"), true);
              return;
            }
            const nearest = E.nearestStation(lat, lng);
            if (!nearest || !nearest.name) {
              showMessage(E.t("geoloc.noStation", "近くに駅が見つかりませんでした。"), true);
              return;
            }
            applyNearestStation(nearest.name);
            // 距離情報があれば成功メッセージに添える
            const distM = typeof nearest.distanceM === "number" ? nearest.distanceM : null;
            const distText =
              distM != null ? `（約${Math.round(distM / 100) / 10}km）` : "";
            showMessage(
              E.t("geoloc.applied", "最寄駅を入力しました: ") + nearest.name + distText,
              false
            );
          } catch (error) {
            console.error("[geoloc] 最寄駅の反映でエラー:", error);
            showMessage(E.t("geoloc.errUnknown", "現在地を取得できませんでした。"), true);
          }
        },
        // 失敗
        (error) => {
          finish();
          showMessage(describeGeoError(error), true);
        },
        // オプション
        {
          enableHighAccuracy: true,
          timeout: GEO_TIMEOUT_MS,
          maximumAge: 0,
        }
      );
    } catch (error) {
      // getCurrentPosition 自体が同期的に投げた場合
      finish();
      console.error("[geoloc] 位置情報取得でエラー:", error);
      showMessage(E.t("geoloc.errUnknown", "現在地を取得できませんでした。"), true);
    }
  }

  button.addEventListener("click", handleClick);
})();
