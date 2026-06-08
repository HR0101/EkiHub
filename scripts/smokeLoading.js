// 算出中ローディング（可愛い電車）の検証
//   - 算出開始直後にオーバーレイが表示される
//   - 最小表示時間(約0.55s)後に消える
//   - 電車・線路・メッセージ要素が存在する / JSエラーが無い

import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// 実際に表示されているか（hidden属性ではなく computed display と矩形で判定）
const visible = async (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const cs = getComputedStyle(el);
    // フェードイン途中(opacity<1)も「表示」とみなす。display:none/visibility:hiddenのみ非表示扱い。
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));

  // 要素の存在確認
  const parts = await page.evaluate(() => ({
    overlay: !!document.getElementById("loadingOverlay"),
    train: !!document.querySelector(".loading__train .train__body"),
    rail: !!document.querySelector(".loading__rail"),
    text: (document.querySelector(".loading__text") || {}).textContent || ""
  }));

  // ロード直後（算出前）は非表示であること
  const shownInitially = await visible(page, "#loadingOverlay");

  // 算出開始 → 直後にオーバーレイが見えるか
  const inputs = await page.$$(".input-row .js-station");
  await inputs[0].type("新宿");
  await inputs[1].type("横浜");
  await page.click("#submitBtn");
  await new Promise((r) => setTimeout(r, 120)); // 表示直後
  const shownDuring = await visible(page, "#loadingOverlay");

  // 最小表示時間後に消えるか（結果が出てから十分待つ）
  await page.waitForFunction(
    () => !document.getElementById("resultCard").classList.contains("is-empty"),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 900));
  const shownAfter = await visible(page, "#loadingOverlay");

  await browser.close();

  console.log("=== ローディング検証 ===");
  console.log("要素: overlay=", parts.overlay, "train=", parts.train, "rail=", parts.rail);
  console.log("メッセージ:", parts.text.replace(/\s+/g, " ").trim());
  console.log("ロード直後に非表示:", !shownInitially, "(期待 true)");
  console.log("算出直後に表示:", shownDuring, "(期待 true)");
  console.log("完了後に非表示:", !shownAfter, "(期待 true)");
  console.log("JSエラー:", errors.length, errors.slice(0, 3));

  const ok =
    parts.overlay && parts.train && !shownInitially && shownDuring && !shownAfter && errors.length === 0;
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("実行失敗:", e);
  process.exit(2);
});
