(() => {
  "use strict";

  // コアが未初期化なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 一時表示(トースト的なボタンラベル切替)の表示時間
  const FEEDBACK_MS = 1800;

  try {
    // 機能固有クラス接頭辞 cs- でスタイルを注入
    E.injectStyle(
      "clipboard-summary-style",
      `
      .cs-btn { white-space: nowrap; }
      .cs-btn[disabled] { opacity: 0.6; cursor: default; }
      .cs-btn.cs-flash { font-weight: 700; }
      `
    );

    // 結果カード内のアクション枠を取得(存在保証だがnullガード必須)
    const host = document.getElementById("hero-actions");
    if (!host) return;

    // コピーボタンを生成(既存の .tool-btn を流用)
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-btn cs-btn";
    const defaultLabel = E.t("clipboardSummary.copy", "結果をコピー");
    button.textContent = defaultLabel;

    host.appendChild(button);

    // 一時表示の解除用タイマー(多重押下時に上書き)
    let feedbackTimer = null;

    // ボタンラベルを一時的に差し替える
    function flashLabel(text) {
      try {
        if (feedbackTimer) {
          clearTimeout(feedbackTimer);
          feedbackTimer = null;
        }
        button.textContent = text;
        button.classList.add("cs-flash");
        feedbackTimer = setTimeout(() => {
          button.textContent = defaultLabel;
          button.classList.remove("cs-flash");
          feedbackTimer = null;
        }, FEEDBACK_MS);
      } catch (err) {
        console.error("clipboardSummary: ラベル更新に失敗しました", err);
      }
    }

    // 押下時の処理
    button.addEventListener("click", () => {
      try {
        const selected = E.getSelected ? E.getSelected() : null;
        const data = E.getResult ? E.getResult() : null;

        // 結果が無ければ案内を一時表示
        if (!data || !selected) {
          flashLabel(
            E.t("clipboardSummary.empty", "先に算出してください")
          );
          return;
        }

        const text = buildSummary(selected, data);
        copyToClipboard(text);
      } catch (err) {
        console.error("clipboardSummary: コピー処理に失敗しました", err);
        flashLabel(E.t("clipboardSummary.error", "コピーに失敗しました"));
      }
    });

    // 算出結果からプレーンテキストの日本語サマリーを生成
    function buildSummary(selected, data) {
      // 見出し行: 集合駅と平均値
      const stationName = safeString(selected.name);
      const avgMin = formatMin(selected.averageMinutes);
      const avgFare = formatFare(selected.averageFareYen);

      const headParts = [];
      if (avgMin !== null) headParts.push("平均" + avgMin);
      if (avgFare !== null) headParts.push(avgFare);
      const headSuffix =
        headParts.length > 0 ? "(" + headParts.join(" / ") + ")" : "";

      const lines = [];
      lines.push("集合駅: " + stationName + (headSuffix ? headSuffix : ""));

      // メンバー名の対応表(無ければ駅名で代替)
      const labels =
        data && data.labels && typeof data.labels === "object"
          ? data.labels
          : {};

      // 各メンバーの所要時間・運賃行
      const travelTimes = Array.isArray(selected.travelTimes)
        ? selected.travelTimes
        : [];

      travelTimes.forEach((tt) => {
        if (!tt) return;
        const fromName = safeString(tt.from);
        const label = labels[tt.from];
        // ラベルがあれば「名前(駅名)」、無ければ駅名のみ
        const who =
          label && safeString(label) !== ""
            ? safeString(label) + "(" + fromName + ")"
            : fromName;

        const segParts = [];
        const min = formatMin(tt.minutes);
        if (min !== null) segParts.push(min);
        const fare = formatFare(tt.fareYen);
        if (fare !== null) segParts.push(fare);
        // 直通可能なら付記
        if (tt.directPossible) segParts.push("直通");

        const segText = segParts.length > 0 ? " " + segParts.join(" ") : "";
        lines.push("・" + who + "→" + segText);
      });

      return lines.join("\n");
    }

    // クリップボードへ書き込む(不可時は prompt フォールバック)
    function copyToClipboard(text) {
      const onSuccess = () => {
        flashLabel(E.t("clipboardSummary.copied", "コピーしました"));
      };
      const onFallback = () => {
        // Clipboard API 不可時は prompt で手動コピーを促す
        try {
          window.prompt(
            E.t("clipboardSummary.fallback", "以下をコピーしてください"),
            text
          );
        } catch (err) {
          console.error("clipboardSummary: フォールバックに失敗しました", err);
        }
      };

      try {
        if (
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          navigator.clipboard
            .writeText(text)
            .then(onSuccess)
            .catch((err) => {
              console.error("clipboardSummary: 書き込みに失敗しました", err);
              onFallback();
            });
          return;
        }
      } catch (err) {
        console.error("clipboardSummary: Clipboard API 例外", err);
      }
      // Clipboard API が無い環境
      onFallback();
    }
  } catch (err) {
    // 初期化全体の保護
    console.error("clipboardSummary: 初期化に失敗しました", err);
  }

  // 文字列を安全に整形(null/undefined を空文字へ)
  function safeString(s) {
    if (s === null || s === undefined) return "";
    return String(s).trim();
  }

  // 分を「N分」へ整形(数値でなければ null)
  function formatMin(n) {
    const num = typeof n === "number" ? n : parseFloat(n);
    if (!isFinite(num)) return null;
    // コアの整形があれば優先利用
    if (typeof E.formatMinutes === "function") {
      try {
        return E.formatMinutes(num);
      } catch (err) {
        console.error("clipboardSummary: formatMinutes 失敗", err);
      }
    }
    return Math.round(num) + "分";
  }

  // 運賃を「¥N」へ整形(数値でなければ null)
  function formatFare(n) {
    const num = typeof n === "number" ? n : parseFloat(n);
    if (!isFinite(num)) return null;
    // コアの整形があれば優先利用
    if (typeof E.formatYen === "function") {
      try {
        return E.formatYen(num);
      } catch (err) {
        console.error("clipboardSummary: formatYen 失敗", err);
      }
    }
    return "¥" + Math.round(num);
  }
})();
