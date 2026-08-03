(() => {
  "use strict";

  // コアが未初期化なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 運賃の重視度ラベル(値域0..100を3段階に分類)
  const LABEL_LOW = E.t("fareWeight.low", "重視しない");
  const LABEL_MID = E.t("fareWeight.mid", "やや重視");
  const LABEL_HIGH = E.t("fareWeight.high", "重視");

  // しきい値(マジックナンバーを定数化)
  const THRESHOLD_LOW = 33; // これ以下は「重視しない」
  const THRESHOLD_HIGH = 66; // これ超は「重視」

  try {
    // 機能固有クラス接頭辞 fw- でスタイルを注入
    E.injectStyle(
      "fareweight-style",
      `
      .fw-field { margin: 8px 0; }
      .fw-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .fw-label { font-size: 13px; font-weight: 600; }
      .fw-value { font-size: 12px; opacity: 0.8; }
      .fw-field .slider { width: 100%; }
      `
    );

    // 入力フォーム枠を取得(存在保証だがnullガード必須)
    const host = document.getElementById("feature-controls");
    if (!host) return;

    // 現在の状態から初期値を算出(0..1 を 0..100 へ)
    const state = E.getState ? E.getState() : null;
    const initWeight =
      state && typeof state.fareWeight === "number" ? state.fareWeight : 0;
    const initValue = clampPercent(Math.round(initWeight * 100));

    // フィールド要素を組み立て
    const field = document.createElement("div");
    field.className = "fw-field";

    const head = document.createElement("div");
    head.className = "fw-head";

    const label = document.createElement("span");
    label.className = "fw-label";
    label.textContent = E.t("fareWeight.title", "運賃の重視度");

    const valueLabel = document.createElement("span");
    valueLabel.className = "fw-value";
    valueLabel.textContent = toLabel(initValue);

    head.appendChild(label);
    head.appendChild(valueLabel);

    // スライダー本体(0-100, 10刻み)
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "slider";
    slider.min = "0";
    slider.max = "100";
    slider.step = "10";
    slider.value = String(initValue);

    field.appendChild(head);
    field.appendChild(slider);
    host.appendChild(field);

    // 外部更新中フラグ(同期時の二重発火を防ぐ)
    let syncing = false;

    // input時は数値ラベルのみ更新(算出はまだ行わない)
    slider.addEventListener("input", () => {
      const v = clampPercent(parseInt(slider.value, 10) || 0);
      valueLabel.textContent = toLabel(v);
    });

    // change時にコアへ反映(0..1へ変換)
    slider.addEventListener("change", () => {
      if (syncing) return;
      try {
        const v = clampPercent(parseInt(slider.value, 10) || 0);
        if (typeof E.setFareWeight === "function") {
          E.setFareWeight(v / 100);
        }
      } catch (err) {
        console.error("fareWeight: setFareWeight に失敗しました", err);
      }
    });

    // 外部からの変更を購読し、スライダー位置とラベルを同期
    if (typeof E.on === "function") {
      E.on("fareweight-change", (v) => {
        try {
          const num = typeof v === "number" ? v : parseFloat(v);
          if (!isFinite(num)) return;
          const next = clampPercent(Math.round(num * 100));
          // 値が変わる場合のみ更新
          if (String(next) === slider.value) {
            valueLabel.textContent = toLabel(next);
            return;
          }
          syncing = true;
          slider.value = String(next);
          valueLabel.textContent = toLabel(next);
          syncing = false;
        } catch (err) {
          syncing = false;
          console.error("fareWeight: 同期処理に失敗しました", err);
        }
      });
    }
  } catch (err) {
    // 初期化全体の保護
    console.error("fareWeight: 初期化に失敗しました", err);
  }

  // 0..100に丸める補助関数
  function clampPercent(n) {
    if (typeof n !== "number" || isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  // 数値を重視度ラベルへ変換
  function toLabel(v) {
    if (v <= THRESHOLD_LOW) return LABEL_LOW;
    if (v > THRESHOLD_HIGH) return LABEL_HIGH;
    return LABEL_MID;
  }
})();
