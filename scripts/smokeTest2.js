// 変更検証用スモークテスト
//   1) 入力行にメンバー名ラベル(.js-label)が無いこと
//   2) 集合時刻(datetime-local)に現在日時が初期入力されていること
//   3) JSエラーが無いこと

import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  const result = await page.evaluate(() => {
    const meetingInput = document.querySelector('#feature-controls input[type="datetime-local"]');
    return {
      hasLabelInput: document.querySelectorAll(".input-row .js-label").length,
      inputRowChildren: document.querySelector(".input-row")
        ? Array.from(document.querySelector(".input-row").children).map((c) => c.className)
        : [],
      meetingValue: meetingInput ? meetingInput.value : null,
      meetingStateViaEkiHub: window.EkiHub ? window.EkiHub.getMeetingTime() : null
    };
  });

  await browser.close();

  // 現在日時(分まで)の期待プレフィックス(YYYY-MM-DD)
  const now = new Date();
  const ymd =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  console.log("=== 検証結果 ===");
  console.log("メンバー名ラベル(.js-label)の数:", result.hasLabelInput, "(期待: 0)");
  console.log("入力行の子要素class:", JSON.stringify(result.inputRowChildren));
  console.log("集合時刻 input.value:", result.meetingValue);
  console.log("集合時刻 EkiHub state:", result.meetingStateViaEkiHub);
  console.log("本日の日付:", ymd, "→ 集合時刻が本日始まりか:", String(result.meetingValue || "").startsWith(ymd));
  console.log("JSエラー:", errors.length, errors.slice(0, 5));

  const ok =
    result.hasLabelInput === 0 &&
    String(result.meetingValue || "").startsWith(ymd) &&
    errors.length === 0;
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("実行失敗:", e);
  process.exit(2);
});
