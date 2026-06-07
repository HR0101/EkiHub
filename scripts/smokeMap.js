// 地図の鉄道オーバーレイ＆経路線の検証
//   - JSエラーが無いこと
//   - レイヤ切替コントロール（鉄道路線）が生成されること
//   - 算出後、各最寄駅→中心駅の経路線(polyline)が描画されること

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

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));

  const before = await page.evaluate(() => ({
    hasLayerControl: !!document.querySelector(".leaflet-control-layers"),
    layerControlText: (document.querySelector(".leaflet-control-layers") || {}).textContent || "",
    railOverlayLabeled: !!Array.from(document.querySelectorAll(".leaflet-control-layers label")).find(
      (l) => /鉄道路線/.test(l.textContent)
    )
  }));

  // 算出
  const inputs = await page.$$(".input-row .js-station");
  await inputs[0].type("新宿");
  await inputs[1].type("横浜");
  await page.click("#submitBtn");
  await page.waitForFunction(
    () => !document.getElementById("resultCard").classList.contains("is-empty"),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 500));

  // 経路線(SVG path) と マーカーの数
  const after = await page.evaluate(() => ({
    // Leafletの折れ線は <path class="leaflet-interactive">、円マーカーも同様。
    paths: document.querySelectorAll(".leaflet-overlay-pane path").length,
    markers: document.querySelectorAll(".leaflet-marker-pane > *").length
  }));

  await browser.close();

  console.log("=== 地図検証 ===");
  console.log("レイヤ切替コントロール:", before.hasLayerControl, "/ '鉄道路線'ラベル:", before.railOverlayLabeled);
  console.log("コントロール内テキスト:", before.layerControlText.replace(/\s+/g, " ").trim());
  console.log("経路線(path)数:", after.paths, "(各最寄駅→中心駅の線。2駅入力なら2以上)");
  console.log("マーカー数:", after.markers);
  console.log("JSエラー:", errors.length, errors.slice(0, 3));

  const ok =
    before.hasLayerControl && before.railOverlayLabeled && after.paths >= 2 && errors.length === 0;
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("実行失敗:", e);
  process.exit(2);
});
