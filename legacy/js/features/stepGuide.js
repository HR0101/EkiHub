// ===== 手順ガイド（stepGuide） =====
// 役割: 「いま何をすべきか」を 1→2→3 のステップで示し，
//       該当する操作UI（駅入力欄／算出ボタン／条件コントロール）を発光リングで強調する.
//
// 判定の流れ:
//   駅が2つ未満        … ステップ1（最寄駅を入力）
//   駅は揃うが結果が古い … ステップ2（算出する）
//   最新の結果がある    … ステップ3（条件を調整して選び直す）
//
// コアには手を入れず，window.EkiHub のイベントと DOM 監視だけで状態を追う.
(() => {
  "use strict";

  // コアが未初期化なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 算出に必要な最低駅数（app.js の MIN_INPUTS と揃えること）
  const MIN_INPUTS = 2;
  // 入力の連続変化をまとめる待ち時間(ms)
  const DEBOUNCE_MS = 120;

  // ステップ定義。targets は強調するUIのCSSセレクタ（存在しなければ黙って飛ばす）
  const STEPS = [
    {
      id: "origins",
      label: E.t("stepGuide.origins", "最寄駅"),
      hint: E.t("stepGuide.originsHint", "集まる人それぞれの最寄駅を、2駅以上入力してください。"),
      targets: ["#stationInputs"]
    },
    {
      id: "compute",
      label: E.t("stepGuide.compute", "算出"),
      hint: E.t("stepGuide.computeHint", "駅が揃いました。「中心駅を算出する」を押してください。"),
      targets: ["#submitBtn"]
    },
    {
      id: "tune",
      label: E.t("stepGuide.tune", "調整"),
      hint: E.t("stepGuide.tuneHint", "候補の絞り込みや重視ポイントを変えると、結果を選び直せます。"),
      // 条件コントロール群は groupTuningControls() でひとまとめにしてから囲む
      targets: [".sg-group"]
    }
  ];

  // ステップ3で囲む条件コントロール（DOM上で連続する兄弟要素）
  const TUNING_SELECTORS = [".mode", ".weight", "#feature-controls"];

  // 強調用クラス（コアのクラス名と衝突しないよう sg- 接頭辞で統一）
  const FOCUS_CLASS = "sg-focus";

  let currentIndex = -1; // 表示中のステップ（未描画は -1）
  let resultSignature = null; // 最後に算出したときの入力内容
  let debounceTimer = null;
  let stepNodes = []; // ステップバーの li 要素
  let nowText = null; // 現在の手順を説明する行

  try {
    injectStyle();

    const host = document.getElementById("feature-steps");
    if (!host) return;

    host.appendChild(buildBar());
    groupTuningControls();
    update();
    bindEvents();
  } catch (err) {
    console.error("stepGuide: 初期化に失敗しました", err);
  }

  // ==================================================================
  // UI 構築
  // ==================================================================

  // ステップバーと説明行をまとめたラッパーを返す
  function buildBar() {
    const wrap = document.createElement("div");
    wrap.className = "sg";

    const bar = document.createElement("ol");
    bar.className = "sg-bar";
    bar.setAttribute("aria-label", E.t("stepGuide.title", "操作の手順"));

    STEPS.forEach((step, index) => {
      const item = document.createElement("li");
      item.className = "sg-step";
      item.dataset.step = step.id;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sg-step__btn";
      // 手順そのものを実行するボタンではないため、役割を明示する
      btn.setAttribute("aria-label", `手順${index + 1}: ${step.label}`);

      const num = document.createElement("span");
      num.className = "sg-step__num";
      num.textContent = String(index + 1);

      const label = document.createElement("span");
      label.className = "sg-step__label";
      label.textContent = step.label;

      btn.appendChild(num);
      btn.appendChild(label);
      // 押したら該当UIまでスクロールして操作を促す
      btn.addEventListener("click", () => revealStep(index));

      item.appendChild(btn);
      bar.appendChild(item);
      stepNodes.push(item);
    });

    nowText = document.createElement("p");
    nowText.className = "sg-now";
    // 手順が切り替わったことを支援技術へ穏やかに通知する
    nowText.setAttribute("role", "status");

    wrap.appendChild(bar);
    wrap.appendChild(nowText);
    return wrap;
  }

  // 条件コントロール（絞り込み・重視ポイント・拡張コントロール）を1つの枠でまとめる.
  // 個別に囲むとリングが3本並んで騒がしくなるため、DOM上で束ねて1本の囲みにする.
  // 各モジュールは追加済みの要素への参照を保持しているので、移動しても動作に影響しない.
  function groupTuningControls() {
    const targets = TUNING_SELECTORS.map((selector) =>
      document.querySelector(selector)
    ).filter(Boolean);
    if (targets.length === 0) return;

    const anchor = targets[0];
    if (!anchor.parentNode) return;

    const group = document.createElement("div");
    group.className = "sg-group";
    anchor.parentNode.insertBefore(group, anchor);
    // DOM順を保ったまま移動する（配列はセレクタ定義の順＝表示順）
    targets.forEach((el) => group.appendChild(el));
  }

  // ==================================================================
  // 状態判定
  // ==================================================================

  // 現在の入力内容を1つの文字列にまとめる（結果の新旧を比べるための指紋）
  function inputSignature() {
    try {
      const rows = typeof E.getInputs === "function" ? E.getInputs() : [];
      return rows
        .map((row) => `${(row.name || "").trim()}*${row.people || 1}`)
        .join("|");
    } catch (err) {
      console.error("stepGuide: 入力の読み取りに失敗しました", err);
      return "";
    }
  }

  // 入力済み（駅名が空でない）行の数を数える
  function filledCount() {
    try {
      const rows = typeof E.getInputs === "function" ? E.getInputs() : [];
      return rows.filter((row) => (row.name || "").trim() !== "").length;
    } catch (err) {
      console.error("stepGuide: 入力の集計に失敗しました", err);
      return 0;
    }
  }

  // いま案内すべきステップの番号を返す
  function resolveStepIndex() {
    if (filledCount() < MIN_INPUTS) return 0;
    // 算出後に入力が変わったら「算出し直す」段階へ戻す
    const hasFreshResult =
      Boolean(E.getResult && E.getResult()) && resultSignature === inputSignature();
    return hasFreshResult ? 2 : 1;
  }

  // ==================================================================
  // 描画
  // ==================================================================

  // ステップの再判定と再描画（変化がなければ何もしない）
  function update() {
    const next = resolveStepIndex();
    if (next === currentIndex) return;
    currentIndex = next;
    renderBar();
    renderFocus();
  }

  // ステップバーの状態（完了／現在／未着手）と説明文を更新する
  function renderBar() {
    stepNodes.forEach((node, index) => {
      node.classList.toggle("is-done", index < currentIndex);
      node.classList.toggle("is-current", index === currentIndex);
      const btn = node.querySelector(".sg-step__btn");
      if (!btn) return;
      if (index === currentIndex) {
        btn.setAttribute("aria-current", "step");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
    if (nowText) nowText.textContent = STEPS[currentIndex].hint;
  }

  // 現在のステップに対応するUIだけに発光リングを付け替える
  function renderFocus() {
    document
      .querySelectorAll("." + FOCUS_CLASS)
      .forEach((el) => el.classList.remove(FOCUS_CLASS));

    STEPS[currentIndex].targets.forEach((selector) => {
      const el = document.querySelector(selector);
      // 中身が空の枠（未使用の拡張枠など）はリングだけが浮くので対象外にする
      if (!el || el.offsetHeight === 0) return;
      el.classList.add(FOCUS_CLASS);
    });
  }

  // ステップバーのクリックで該当UIへ案内する
  function revealStep(index) {
    const target = STEPS[index].targets
      .map((selector) => document.querySelector(selector))
      .find((el) => el && el.offsetHeight > 0);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // 入力欄なら続けて打てるようフォーカスまで移す
    const focusable = target.matches("button, input")
      ? target
      : target.querySelector("input, button");
    if (focusable) focusable.focus({ preventScroll: true });
  }

  // ==================================================================
  // イベント購読
  // ==================================================================

  function bindEvents() {
    // コアからの通知（駅マスタ読込・入力変更・算出完了）
    if (typeof E.on === "function") {
      E.on("ready", update);
      E.on("inputs-change", update);
      E.on("result", () => {
        resultSignature = inputSignature();
        update();
      });
    }

    const inputsBox = document.getElementById("stationInputs");
    if (!inputsBox) return;

    // コアの inputs-change は確定時（change）にしか飛ばないため、
    // 打鍵中の追従はここで拾う
    inputsBox.addEventListener("input", scheduleUpdate);

    // 行の追加・削除に追従する
    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver(scheduleUpdate);
      observer.observe(inputsBox, { childList: true });
    }
  }

  // 連続入力をまとめて1回だけ再判定する
  function scheduleUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      update();
    }, DEBOUNCE_MS);
  }

  // ==================================================================
  // スタイル
  // ==================================================================

  function injectStyle() {
    if (typeof E.injectStyle !== "function") return;
    E.injectStyle(
      "stepguide-style",
      `
      .sg { margin: 0 0 18px; }

      /* ステップバー本体（沈んだ溝の上に現在のステップだけが浮く） */
      .sg-bar {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        margin: 0;
        padding: 4px;
        list-style: none;
        background: var(--nm-surface-sunken);
        border-radius: 14px;
        box-shadow: var(--nm-sunken);
      }

      .sg-step { min-width: 0; }

      .sg-step__btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 9px 6px;
        border: none;
        border-radius: 11px;
        background: transparent;
        color: var(--text-faint);
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          color var(--transition),
          background var(--transition),
          box-shadow var(--transition),
          transform var(--transition);
      }

      /* 押し込み（style.css の共通演出と速度を揃える） */
      .sg-step__btn:active {
        transform: translateY(var(--nm-press-offset)) scale(0.96);
        transition: transform var(--nm-press-time) ease-out;
      }

      .sg-step__num {
        flex: 0 0 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--nm-surface);
        box-shadow: var(--nm-raised-sm);
        font-size: 0.72rem;
        line-height: 1;
        transition: background var(--transition), color var(--transition), box-shadow var(--transition);
      }

      .sg-step__label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* 完了したステップ：面は沈んだまま、番号だけ達成色にする */
      .sg-step.is-done .sg-step__btn { color: var(--text-sub); }

      .sg-step.is-done .sg-step__num {
        background: var(--accent-3);
        box-shadow: none;
        color: #06231e;
        font-size: 0.78rem;
      }

      /* 現在のステップ：面が浮き上がり、番号がアクセント色に光る */
      .sg-step.is-current .sg-step__btn {
        background: var(--nm-surface);
        box-shadow: var(--nm-raised-sm);
        color: var(--text-main);
      }

      .sg-step.is-current .sg-step__num {
        background: linear-gradient(120deg, var(--accent), var(--accent-2));
        box-shadow: 0 4px 12px rgba(14, 138, 69, 0.45);
        color: #fff;
      }

      /* 現在の手順の説明 */
      .sg-now {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        margin: 10px 2px 0;
        font-size: 0.79rem;
        line-height: 1.6;
        color: var(--text-sub);
      }

      .sg-now::before {
        content: "";
        flex: 0 0 6px;
        height: 6px;
        margin-top: 8px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px rgba(14, 138, 69, 0.18);
      }

      /* 条件コントロールをまとめる枠。見た目は持たず、囲みの範囲を決めるためだけに存在する */
      .sg-group { display: block; padding-bottom: 4px; }

      /* いま操作すべきUIを囲む発光リング（操作の邪魔をしないよう疑似要素で描く） */
      .sg-focus { position: relative; }

      .sg-focus::after {
        content: "";
        position: absolute;
        inset: -8px -10px;
        border-radius: 16px;
        pointer-events: none;
        box-shadow:
          0 0 0 1.5px rgba(14, 138, 69, 0.5),
          0 0 22px rgba(14, 138, 69, 0.22);
        box-shadow:
          0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, transparent),
          0 0 22px color-mix(in srgb, var(--accent) 24%, transparent);
      }

      /* 高コントラストでは光が滲んで見えづらいので実線の枠で示す */
      [data-color="high-contrast"] .sg-focus::after {
        box-shadow: none;
        border: 2px dashed var(--accent);
      }

      [data-color="high-contrast"] .sg-bar,
      [data-color="high-contrast"] .sg-step.is-current .sg-step__btn {
        box-shadow: none;
        border: 2px solid var(--border-soft);
      }

      @media (prefers-reduced-motion: reduce) {
        .sg-step__btn:active { transform: none; }
      }

      /* 幅が狭いときはラベルを畳んで番号だけにする */
      @media (max-width: 420px) {
        .sg-step__label { display: none; }
        .sg-step__btn { gap: 0; }
      }

      /* 印刷にはガイドを含めない */
      @media print {
        .sg { display: none !important; }
        .sg-focus::after { display: none !important; }
      }
      `
    );
  }
})();
