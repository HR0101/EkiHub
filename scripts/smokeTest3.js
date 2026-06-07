// 候補リスト(予想欄)の重なり検証
//   1行目で候補を開き、候補リストが2行目の入力欄の上に正しく重なって表示されるかを
//   document.elementFromPoint で判定する（候補リスト領域のヒットテスト）。

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
  await page.setViewport({ width: 1200, height: 900 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));

  // 1行目の駅名入力に文字を入れて候補を開く
  const firstInput = await page.$(".input-row .js-station");
  await firstInput.click();
  await firstInput.type("新");
  await new Promise((r) => setTimeout(r, 300));

  const result = await page.evaluate(() => {
    const rows = document.querySelectorAll(".input-row");
    const suggest = rows[0].querySelector(".suggest");
    const isOpen = suggest && suggest.classList.contains("is-open");
    const sRect = suggest.getBoundingClientRect();
    const secondInput = rows[1].querySelector(".js-station");
    const inRect = secondInput.getBoundingClientRect();

    // 候補リストと2行目入力欄が縦に重なる領域があるか
    const overlapTop = Math.max(sRect.top, inRect.top);
    const overlapBottom = Math.min(sRect.bottom, inRect.bottom);
    const verticallyOverlaps = overlapBottom > overlapTop;

    // 重なり領域の中心点で最前面要素を取得
    let topElementIsSuggest = null;
    let topElementClass = null;
    if (verticallyOverlaps) {
      const x = sRect.left + sRect.width / 2;
      const y = (overlapTop + overlapBottom) / 2;
      const el = document.elementFromPoint(x, y);
      topElementClass = el ? el.className : null;
      topElementIsSuggest = !!(el && el.closest && el.closest(".suggest"));
    }

    return {
      isOpen,
      suggestItems: suggest.querySelectorAll(".suggest__item").length,
      verticallyOverlaps,
      topElementClass,
      topElementIsSuggest
    };
  });

  await browser.close();

  console.log("=== 候補リスト重なり検証 ===");
  console.log("候補オープン:", result.isOpen, "/ 候補件数:", result.suggestItems);
  console.log("2行目入力欄と縦に重なる領域:", result.verticallyOverlaps);
  console.log("重なり点の最前面class:", result.topElementClass);
  console.log("最前面が候補リストか:", result.topElementIsSuggest, "(trueなら重なり解消)");
  console.log("JSエラー:", errors.length);

  // 重なり領域があり、その最前面が候補リストなら合格
  const ok = result.isOpen && result.verticallyOverlaps && result.topElementIsSuggest && errors.length === 0;
  console.log(ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("実行失敗:", e);
  process.exit(2);
});
