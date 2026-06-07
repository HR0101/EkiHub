// 周辺スポット機能のブラウザ検証
//   渋谷を1駅目に入れて算出 → カフェカテゴリを押し → スポットが表示されるか確認
//   (サーバーがOverpassに到達できない場合でも、ブラウザ直接フォールバックで取得できること)

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

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));

  // 渋谷・横浜で算出
  const inputs = await page.$$(".input-row .js-station");
  await inputs[0].type("渋谷");
  await inputs[1].type("横浜");
  await page.click("#submitBtn");
  await page.waitForFunction(
    () => !document.getElementById("resultCard").classList.contains("is-empty"),
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 400));

  // 候補1位(=渋谷寄りの中心駅)を選択した状態でカフェカテゴリを押す
  const catBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll(".nsp-cat"));
    return btns.find((b) => b.dataset.category === "cafe");
  });
  await catBtn.click();

  // スポットのリスト項目が現れるまで待つ（最大25秒。Overpass応答待ち）
  let status = "";
  let count = 0;
  try {
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll(".nsp-item").length;
        const st = document.querySelector(".nsp-status");
        const txt = st ? st.textContent : "";
        // 件数表示 or 何らかの確定状態になったら抜ける
        return items > 0 || /見つかりません|取得できません/.test(txt);
      },
      { timeout: 25000 }
    );
  } catch (e) {
    // タイムアウトはそのまま下で状態を読む
  }
  const info = await page.evaluate(() => ({
    items: document.querySelectorAll(".nsp-item").length,
    status: (document.querySelector(".nsp-status") || {}).textContent || "",
    markers: document.querySelectorAll(".leaflet-interactive").length
  }));
  count = info.items;
  status = info.status;

  await browser.close();

  console.log("=== 周辺スポット検証 ===");
  console.log("スポット件数:", count);
  console.log("ステータス表示:", status);
  console.log("地図マーカー(interactive)数:", info.markers);
  console.log("JSエラー:", errors.length, errors.slice(0, 3));

  const ok = count > 0 && errors.length === 0;
  console.log(ok ? "PASS（スポット取得・表示OK）" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("実行失敗:", e);
  process.exit(2);
});
