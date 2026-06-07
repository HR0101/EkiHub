// ブラウザでのスモークテスト
// 目的: 機能モジュール読込時のJSエラー検出と、UI拡張枠が正しく構築されたかの確認.
//   1) ページを開き console エラー / ページエラーを収集
//   2) 算出を1回実行し、結果カード・各拡張枠のボタン数を数える
//   3) 候補ランキングのクリックで切替が動くかを確認

import puppeteer from "puppeteer";

const BASE = "http://localhost:3000";

function findChrome() {
  return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: findChrome(),
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  // 機能モジュール(defer)の実行完了を待つ
  await new Promise((r) => setTimeout(r, 800));

  // 拡張枠のボタン/要素数を数える
  const counts = await page.evaluate(() => ({
    toolbar: document.querySelectorAll("#toolbar > *").length,
    featureControls: document.querySelectorAll("#feature-controls > *").length,
    inputRows: document.querySelectorAll(".input-row").length,
    hasEkiHub: typeof window.EkiHub === "object",
    hasQRCode: typeof window.QRCode !== "undefined"
  }));

  // 2駅入力して算出
  const inputs = await page.$$(".input-row .js-station");
  await inputs[0].type("新宿");
  await inputs[1].type("横浜");
  await page.click("#submitBtn");
  // 結果待ち
  await page.waitForFunction(
    () => !document.getElementById("resultCard").classList.contains("is-empty"),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 600));

  const afterCompute = await page.evaluate(() => ({
    bestName: document.getElementById("bestName").textContent,
    bestFare: document.getElementById("bestFare").textContent,
    heroActions: document.querySelectorAll("#hero-actions > *").length,
    featurePanels: document.querySelectorAll("#feature-panels > *").length,
    rankingItems: document.querySelectorAll(".ranking-item").length,
    travelItems: document.querySelectorAll(".travel-item").length
  }));

  // ランキング2位をクリックして切替確認
  let switched = null;
  const items = await page.$$(".ranking-item");
  if (items.length >= 2) {
    await items[1].click();
    await new Promise((r) => setTimeout(r, 300));
    switched = await page.evaluate(() => document.getElementById("bestName").textContent);
  }

  await browser.close();

  console.log("=== スモークテスト結果 ===");
  console.log("EkiHub存在:", counts.hasEkiHub, "/ QRCode存在:", counts.hasQRCode);
  console.log("toolbarボタン数:", counts.toolbar, "(期待: テーマ+言語+履歴=3)");
  console.log("feature-controls要素数:", counts.featureControls, "(期待: 現在地+運賃+集合時刻=3)");
  console.log("初期入力行数:", counts.inputRows);
  console.log("--- 算出後 ---");
  console.log("中心駅:", afterCompute.bestName, "/ 平均運賃:", afterCompute.bestFare);
  console.log("hero-actionsボタン数:", afterCompute.heroActions, "(期待: 共有/QR/コピー/カレンダー/印刷 ≧5)");
  console.log("feature-panels数:", afterCompute.featurePanels, "(期待: 出発時刻+周辺スポット=2)");
  console.log("ランキング件数:", afterCompute.rankingItems, "/ 所要時間バー:", afterCompute.travelItems);
  console.log("候補切替後の中心駅:", switched, "(2位に変わっていれば成功)");
  console.log("--- エラー ---");
  console.log("pageerror:", pageErrors.length, pageErrors.slice(0, 5));
  console.log("console.error:", consoleErrors.length, consoleErrors.slice(0, 8));

  // エラーがあれば終了コード1
  process.exit(pageErrors.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error("スモークテスト実行失敗:", err);
  process.exit(2);
});
