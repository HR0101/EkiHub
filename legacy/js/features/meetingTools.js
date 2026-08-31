(() => {
  "use strict";

  // コアが未初期化なら何もしない
  if (!window.EkiHub) return;
  const E = window.EkiHub;

  // ICSのイベント長(集合からの所要)を定数化(マジックナンバー回避)
  const EVENT_DURATION_HOURS = 2;
  // 一時メッセージの表示時間(ミリ秒)
  const TOAST_DURATION_MS = 2200;

  // 機能固有クラス接頭辞 mt- でスタイルを注入
  E.injectStyle(
    "meeting-tools-style",
    `
    .mt-field { margin: 8px 0; }
    .mt-field__label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .mt-field__input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--border-soft, rgba(120,120,120,0.4));
      background: var(--bg-input, rgba(255,255,255,0.06));
      color: inherit;
      font: inherit;
    }
    .mt-panel__empty {
      font-size: 13px;
      opacity: 0.8;
      line-height: 1.6;
    }
    .mt-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mt-item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      font-size: 13px;
      line-height: 1.5;
    }
    .mt-item__name { font-weight: 600; }
    .mt-item__time { opacity: 0.95; text-align: right; }
    .mt-item__depart { font-weight: 700; }
    .mt-item__dur { font-size: 12px; opacity: 0.7; margin-left: 6px; }
    .mt-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: rgba(20, 22, 30, 0.95);
      color: #fff;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
      z-index: 9999;
      pointer-events: none;
    }
    `
  );

  // 一時メッセージを画面下部に表示する
  const showToast = (message) => {
    try {
      const toast = document.createElement("div");
      toast.className = "mt-toast";
      toast.textContent = message;
      document.body.appendChild(toast);
      window.setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, TOAST_DURATION_MS);
    } catch (err) {
      console.error("[meetingTools] トースト表示に失敗しました:", err);
    }
  };

  // 集合時刻文字列("YYYY-MM-DDTHH:mm")をDateへ。失敗時はnull
  const parseMeeting = (str) => {
    if (!str) return null;
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  };

  // 現在のローカル日時を datetime-local 形式("YYYY-MM-DDTHH:mm")で返す
  // 集合時刻の初期値として用い、年月日の入力を不要にする
  const currentLocalDateTime = () => {
    const now = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
      `T${p(now.getHours())}:${p(now.getMinutes())}`
    );
  };

  // DateをHH:MM表記へ(ローカル時刻)
  const formatHHMM = (date) => {
    if (!date || isNaN(date.getTime())) return "--:--";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // メンバー名を取得(data.labels優先,無ければ駅名)
  const memberName = (data, stationName) => {
    const labels = data && data.labels ? data.labels : {};
    const label = labels[stationName];
    return label != null && String(label).length > 0
      ? String(label)
      : String(stationName);
  };

  // -------------------------------------------------------------------
  // 1) #feature-controls: 集合時刻の入力欄
  // -------------------------------------------------------------------
  const mountControl = () => {
    const host = document.getElementById("feature-controls");
    if (!host) return; // nullガード
    if (host.querySelector('[data-meeting-tools="control"]')) return; // 二重生成防止

    const field = document.createElement("div");
    field.className = "mt-field";
    field.setAttribute("data-meeting-tools", "control");

    const label = document.createElement("label");
    label.className = "mt-field__label";
    label.textContent = E.t ? E.t("meeting.label", "集合時刻") : "集合時刻";

    const input = document.createElement("input");
    input.type = "datetime-local";
    input.className = "mt-field__input";

    // ラベルとinputを関連付け
    const inputId = "mt-meeting-input";
    input.id = inputId;
    label.setAttribute("for", inputId);

    // 初期値を反映。未設定なら現在日時を初期入力しておく（年月日の入力を省く）
    try {
      const initial = E.getMeetingTime ? E.getMeetingTime() : null;
      if (initial) {
        input.value = initial;
      } else {
        const nowLocal = currentLocalDateTime();
        input.value = nowLocal;
        if (typeof E.setMeetingTime === "function") E.setMeetingTime(nowLocal);
      }
    } catch (err) {
      console.error("[meetingTools] 初期集合時刻の設定に失敗しました:", err);
    }

    // change時にコアへ反映
    input.addEventListener("change", () => {
      try {
        if (typeof E.setMeetingTime === "function") {
          E.setMeetingTime(input.value || "");
        }
      } catch (err) {
        console.error("[meetingTools] 集合時刻の設定に失敗しました:", err);
      }
    });

    // 外部からの集合時刻変更を購読し,入力欄を同期
    if (typeof E.on === "function") {
      E.on("meeting-change", (str) => {
        const next = str || "";
        if (input.value !== next) input.value = next;
      });
    }

    field.appendChild(label);
    field.appendChild(input);
    host.appendChild(field);
  };

  // -------------------------------------------------------------------
  // 2) #feature-panels: 各メンバーの出発時刻パネル
  // -------------------------------------------------------------------
  let panelBody = null; // 描画対象の本体要素を保持

  const mountPanel = () => {
    const host = document.getElementById("feature-panels");
    if (!host) return; // nullガード
    if (host.querySelector('[data-meeting-tools="panel"]')) {
      // 既存ならbody参照だけ取り直す
      panelBody = host.querySelector(".mt-panel__body");
      return;
    }

    const panel = document.createElement("section");
    panel.className = "fpanel";
    panel.setAttribute("data-meeting-tools", "panel");

    const title = document.createElement("div");
    title.className = "fpanel__title";
    title.textContent = E.t
      ? E.t("meeting.panelTitle", "各メンバーの出発時刻")
      : "各メンバーの出発時刻";

    panelBody = document.createElement("div");
    panelBody.className = "mt-panel__body";

    panel.appendChild(title);
    panel.appendChild(panelBody);
    host.appendChild(panel);
  };

  // 未設定時のメッセージを描画
  const renderEmpty = () => {
    if (!panelBody) return;
    const msg = E.t
      ? E.t(
          "meeting.empty",
          "集合時刻を入力すると、各メンバーの出発目安を表示します"
        )
      : "集合時刻を入力すると、各メンバーの出発目安を表示します";
    panelBody.innerHTML = `<p class="mt-panel__empty">${E.escapeHtml(msg)}</p>`;
  };

  // 出発時刻リストを描画
  const renderPanel = () => {
    if (!panelBody) return;

    try {
      const meetingStr = E.getMeetingTime ? E.getMeetingTime() : null;
      const meetingDate = parseMeeting(meetingStr);

      // 集合時刻が未設定/不正なら案内文
      if (!meetingDate) {
        renderEmpty();
        return;
      }

      const selected = E.getSelected ? E.getSelected() : null;
      const data = E.getResult ? E.getResult() : null;

      // 候補駅やtravelTimesが無ければ案内文
      if (
        !selected ||
        !Array.isArray(selected.travelTimes) ||
        selected.travelTimes.length === 0
      ) {
        renderEmpty();
        return;
      }

      const meetingHHMM = formatHHMM(meetingDate);

      // 各メンバーの出発時刻 = 集合時刻 - minutes
      const items = selected.travelTimes.map((tt) => {
        const minutes =
          typeof tt.minutes === "number" && isFinite(tt.minutes)
            ? tt.minutes
            : 0;
        const departDate = new Date(meetingDate.getTime() - minutes * 60000);
        const name = memberName(data, tt.from);
        return { name, station: tt.from, departHHMM: formatHHMM(departDate), minutes };
      });

      const durLabel = (n) =>
        E.formatMinutes ? E.formatMinutes(n) : `${n}分`;

      // 「名前(駅名): HH:MM 発 → 集合HH:MM(約N分)」のリスト
      const lis = items
        .map((it) => {
          const head = `${E.escapeHtml(it.name)}（${E.escapeHtml(
            it.station
          )}）`;
          const around = E.t ? E.t("meeting.about", "約") : "約";
          return `
            <li class="mt-item">
              <span class="mt-item__name">${head}</span>
              <span class="mt-item__time">
                <span class="mt-item__depart">${E.escapeHtml(
                  it.departHHMM
                )}</span> 発
                → 集合${E.escapeHtml(meetingHHMM)}
                <span class="mt-item__dur">(${around}${E.escapeHtml(
            durLabel(it.minutes)
          )})</span>
              </span>
            </li>`;
        })
        .join("");

      panelBody.innerHTML = `<ul class="mt-list">${lis}</ul>`;
    } catch (err) {
      console.error("[meetingTools] 出発時刻パネルの描画に失敗しました:", err);
      renderEmpty();
    }
  };

  // -------------------------------------------------------------------
  // 3) #hero-actions: カレンダーに追加(.ics)ボタン
  // -------------------------------------------------------------------

  // DateをICSのローカル日時(YYYYMMDDTHHMMSS)へ整形
  const toIcsLocal = (date) => {
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
      `T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
    );
  };

  // ICS仕様に従いテキストをエスケープ
  const escapeIcs = (str) =>
    String(str == null ? "" : str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");

  // .icsファイル文字列を生成する
  const buildIcs = (stationName, meetingDate) => {
    const start = meetingDate;
    const end = new Date(
      meetingDate.getTime() + EVENT_DURATION_HOURS * 3600000
    );
    const stamp = toIcsLocal(new Date());
    // 衝突しにくい一意IDを生成
    const uid = `ekihub-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@ekihub`;
    const summary = E.t
      ? E.t("meeting.icsSummary", "{station}で集合").replace(
          "{station}",
          stationName
        )
      : `${stationName}で集合`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EkiHub//meetingTools//JA",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsLocal(start)}`,
      `DTEND:${toIcsLocal(end)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs(stationName)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    // ICSはCRLF区切りが推奨
    return lines.join("\r\n");
  };

  // Blobとしてダウンロードさせる
  const downloadIcs = (filename, content) => {
    try {
      const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 後始末
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[meetingTools] icsダウンロードに失敗しました:", err);
      showToast(
        E.t ? E.t("meeting.icsError", "カレンダーの生成に失敗しました") : "カレンダーの生成に失敗しました"
      );
    }
  };

  // Google Calendar URL用の日時文字列(YYYYMMDDTHHMMSS)を生成する
  const toGCalLocal = (date) => {
    const p = (n) => String(n).padStart(2, "0");
    return (
      `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
      `T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
    );
  };

  // Google Calendar に追加するURLを生成する
  const buildGoogleCalendarUrl = (stationName, meetingDate) => {
    const start = meetingDate;
    const end = new Date(meetingDate.getTime() + EVENT_DURATION_HOURS * 3600000);
    const summary = E.t
      ? E.t("meeting.icsSummary", "{station}で集合").replace("{station}", stationName)
      : `${stationName}で集合`;

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: summary,
      dates: `${toGCalLocal(start)}/${toGCalLocal(end)}`,
      location: stationName,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Googleカレンダーボタン押下時の処理
  const handleGoogleCalendarClick = () => {
    try {
      const meetingStr = E.getMeetingTime ? E.getMeetingTime() : null;
      const meetingDate = parseMeeting(meetingStr);

      if (!meetingDate) {
        showToast(
          E.t ? E.t("meeting.needTime", "集合時刻を入力してください") : "集合時刻を入力してください"
        );
        return;
      }

      const selected = E.getSelected ? E.getSelected() : null;
      const data = E.getResult ? E.getResult() : null;
      const station = selected || (data && data.best ? data.best : null);

      if (!station || !station.name) {
        showToast(
          E.t ? E.t("meeting.needStation", "先に中心駅を算出してください") : "先に中心駅を算出してください"
        );
        return;
      }

      const url = buildGoogleCalendarUrl(station.name, meetingDate);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("[meetingTools] Googleカレンダー追加に失敗しました:", err);
      showToast(
        E.t ? E.t("meeting.icsError", "カレンダーの生成に失敗しました") : "カレンダーの生成に失敗しました"
      );
    }
  };

  const mountGoogleCalendarButton = () => {
    const host = document.getElementById("hero-actions");
    if (!host) return;
    if (host.querySelector('[data-meeting-tools="gcal"]')) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn";
    btn.setAttribute("data-meeting-tools", "gcal");
    btn.textContent = E.t ? E.t("meeting.addToGcal", "Googleカレンダー") : "Googleカレンダー";
    btn.addEventListener("click", handleGoogleCalendarClick);
    host.appendChild(btn);
  };

  // ボタン押下時の処理
  const handleCalendarClick = () => {
    try {
      const meetingStr = E.getMeetingTime ? E.getMeetingTime() : null;
      const meetingDate = parseMeeting(meetingStr);

      // 集合時刻未設定なら一時メッセージ
      if (!meetingDate) {
        showToast(
          E.t
            ? E.t("meeting.needTime", "集合時刻を入力してください")
            : "集合時刻を入力してください"
        );
        return;
      }

      // 選択駅(無ければbest)を採用
      const selected = E.getSelected ? E.getSelected() : null;
      const data = E.getResult ? E.getResult() : null;
      const station =
        selected || (data && data.best ? data.best : null);

      if (!station || !station.name) {
        showToast(
          E.t
            ? E.t("meeting.needStation", "先に中心駅を算出してください")
            : "先に中心駅を算出してください"
        );
        return;
      }

      const ics = buildIcs(station.name, meetingDate);
      const safeName = String(station.name).replace(/[\\/:*?"<>|]/g, "_");
      downloadIcs(`ekihub-${safeName}.ics`, ics);
    } catch (err) {
      console.error("[meetingTools] カレンダー追加に失敗しました:", err);
      showToast(
        E.t ? E.t("meeting.icsError", "カレンダーの生成に失敗しました") : "カレンダーの生成に失敗しました"
      );
    }
  };

  const mountCalendarButton = () => {
    const host = document.getElementById("hero-actions");
    if (!host) return; // nullガード
    if (host.querySelector('[data-meeting-tools="calendar"]')) return; // 二重生成防止

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool-btn";
    btn.setAttribute("data-meeting-tools", "calendar");
    btn.textContent = E.t
      ? E.t("meeting.addToCalendar", "カレンダーに追加")
      : "カレンダーに追加";
    btn.addEventListener("click", handleCalendarClick);
    host.appendChild(btn);
  };

  // -------------------------------------------------------------------
  // 初期化と購読
  // -------------------------------------------------------------------
  try {
    // 起動直後に枠を先に作る
    mountControl();
    mountPanel();
    mountCalendarButton();
    mountGoogleCalendarButton();
    renderPanel();

    if (typeof E.on === "function") {
      // 結果/候補切替/集合時刻変更で,枠の再設置とパネル再描画
      const refresh = () => {
        mountControl();
        mountPanel();
        mountCalendarButton();
        mountGoogleCalendarButton();
        renderPanel();
      };
      E.on("result", refresh);
      E.on("select", refresh);
      E.on("meeting-change", refresh);
    }
  } catch (err) {
    console.error("[meetingTools] 初期化に失敗しました:", err);
  }
})();
