(() => {
  "use strict";

  // コアが未初期化なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // 機能固有のCSS(接頭辞 share-)を注入
  E.injectStyle(
    "share-link-style",
    `
    .share-link__copied {
      background: #1f9d55 !important;
      color: #fff !important;
      border-color: #1f9d55 !important;
    }
    .share-link__btn {
      margin-left: 4px;
    }
    `
  );

  // 共有用URLを組み立てる
  // ?o=駅名 / mode / w(公平性重み*100) / fw(運賃重み*100)
  //   / names(ラベル) / people(人数) / t(集合時刻)
  // o/names/people は getInputs() の順で位置対応させ,空ラベルも空文字で維持する
  const buildShareUrl = () => {
    try {
      const state = E.getState ? E.getState() : {};
      const inputs = (E.getInputs && E.getInputs()) || [];

      // 駅名・ラベル・人数を入力順で配列化(位置維持のため空文字許容)
      const stationNames = [];
      const labels = [];
      const peoples = [];
      inputs.forEach((row) => {
        stationNames.push(row && row.name != null ? String(row.name) : "");
        labels.push(row && row.label != null ? String(row.label) : "");
        peoples.push(row && row.people != null ? String(row.people) : "");
      });

      // 各パラメータをencodeURIComponentで安全化
      const enc = (v) => encodeURIComponent(v == null ? "" : String(v));

      const mode = state.currentMode != null ? state.currentMode : "";
      // 公平性重み(0..1)を0..100へ
      const fairnessWeight =
        typeof state.fairnessWeight === "number" ? state.fairnessWeight : 0;
      const w = Math.round(fairnessWeight * 100);
      // 運賃重み(0..1)を0..100へ
      const fareWeight =
        typeof state.fareWeight === "number" ? state.fareWeight : 0;
      const fw = Math.round(fareWeight * 100);
      // 集合時刻(未設定はnull)
      const meetingTime =
        state.meetingTime != null ? state.meetingTime : "";

      const params = [];
      params.push("o=" + stationNames.map(enc).join(","));
      params.push("mode=" + enc(mode));
      params.push("w=" + enc(w));
      params.push("fw=" + enc(fw));
      params.push("names=" + labels.map(enc).join(","));
      params.push("people=" + peoples.map(enc).join(","));
      params.push("t=" + enc(meetingTime));

      const base = location.origin + location.pathname;
      return base + "?" + params.join("&");
    } catch (err) {
      // 失敗時は最低限ベースURLを返す
      console.error("[shareLink] URL生成に失敗しました:", err);
      return location.origin + location.pathname;
    }
  };

  // クリップボードへコピー。不可環境はprompt表示でフォールバック
  const copyToClipboard = async (url, button) => {
    const labelCopy = E.t ? E.t("share.copy", "URLをコピー") : "URLをコピー";
    const labelCopied = E.t
      ? E.t("share.copied", "コピーしました")
      : "コピーしました";

    // 一時的に「コピーしました」を表示して元へ戻す
    const showCopied = () => {
      if (!button) return;
      button.textContent = labelCopied;
      button.classList.add("share-link__copied");
      window.setTimeout(() => {
        button.textContent = labelCopy;
        button.classList.remove("share-link__copied");
      }, 1500);
    };

    // フォールバック: promptでURLを提示
    const fallbackPrompt = () => {
      try {
        window.prompt(
          E.t ? E.t("share.promptHint", "このURLをコピーしてください") : "このURLをコピーしてください",
          url
        );
      } catch (err) {
        console.error("[shareLink] フォールバック表示に失敗しました:", err);
      }
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showCopied();
      } else {
        // クリップボードAPI非対応
        fallbackPrompt();
      }
    } catch (err) {
      // 権限拒否などで失敗した場合もフォールバック
      console.error("[shareLink] クリップボードへのコピーに失敗しました:", err);
      fallbackPrompt();
    }
  };

  // Web Share APIで共有
  const shareViaWebShare = async (url) => {
    try {
      const title = E.t ? E.t("share.title", "EkiHub 中心駅の提案") : "EkiHub 中心駅の提案";
      const text = E.t
        ? E.t("share.text", "みんなの中心駅を計算しました")
        : "みんなの中心駅を計算しました";
      await navigator.share({ title, text, url });
    } catch (err) {
      // ユーザーキャンセル(AbortError)は無視。それ以外はログ出力
      if (err && err.name !== "AbortError") {
        console.error("[shareLink] 共有に失敗しました:", err);
      }
    }
  };

  // ボタン生成のヘルパ
  const createButton = (text, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn share-link__btn";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  };

  // #hero-actions にボタンを設置する
  const mountButtons = () => {
    const host = document.getElementById("hero-actions");
    if (!host) return; // nullガード

    // 二重生成防止
    if (host.querySelector('[data-share-link="copy"]')) return;

    // 「URLをコピー」ボタン
    const labelCopy = E.t ? E.t("share.copy", "URLをコピー") : "URLをコピー";
    const copyBtn = createButton(labelCopy, () => {
      const url = buildShareUrl();
      copyToClipboard(url, copyBtn);
    });
    copyBtn.setAttribute("data-share-link", "copy");
    host.appendChild(copyBtn);

    // Web Share API対応端末では「共有」ボタンも追加
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const labelShare = E.t ? E.t("share.share", "共有") : "共有";
      const shareBtn = createButton(labelShare, () => {
        const url = buildShareUrl();
        shareViaWebShare(url);
      });
      shareBtn.setAttribute("data-share-link", "share");
      host.appendChild(shareBtn);
    }
  };

  // 起動直後に枠(ボタン)を先に作る。結果更新時にも存在保証のため再設置を試みる
  try {
    mountButtons();
    // 結果確定/候補切替の購読(枠が消えていた場合の再設置に備える)
    if (E.on) {
      E.on("result", mountButtons);
      E.on("select", mountButtons);
    }
  } catch (err) {
    console.error("[shareLink] 初期化に失敗しました:", err);
  }
})();
