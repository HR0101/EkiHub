/**
 * README.md の Mermaid 図を SVG / PNG へ書き出す.
 *
 * README を唯一の原本とし、画像はそこから生成する（図の二重管理を避ける）.
 * 出力先は assets/ で、README からはリンクで参照する.
 *
 * 使い方:
 *   PUPPETEER_SKIP_DOWNLOAD=1 npm i --no-save @mermaid-js/mermaid-cli
 *   node scripts/renderDiagrams.mjs
 *
 * mermaid-cli は Chrome を必要とするが、ダウンロードはせず
 * 端末にインストール済みの Chrome を使う（CHROME_PATH で変更可能）.
 * 依存が重いため package.json には入れていない（図を直した時だけ実行する）.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README_PATH = join(ROOT, "README.md");
const OUTPUT_DIR = join(ROOT, "assets");
const TMP_DIR = join(ROOT, ".diagram-tmp");
const MMDC = join(ROOT, "node_modules", ".bin", "mmdc");

/** 図の背景（透明にすると GitHub のダークモードで文字が読めなくなる） */
const BACKGROUND = "white";
/** SVG の基準幅と、PNG の拡大率（PNG は貼り付け用なので 2 倍で書き出す） */
const SVG_WIDTH = 1600;
const PNG_SCALE = 2;

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * README から `<!-- diagram: 名前 -->` が付いた mermaid ブロックを取り出す.
 * 名前がそのまま出力ファイル名になる.
 */
function extractDiagrams(markdown) {
  const pattern = /<!--\s*diagram:\s*([\w-]+)\s*-->\s*\n```mermaid\n([\s\S]*?)```/g;
  return [...markdown.matchAll(pattern)].map((match) => ({
    name: match[1],
    code: match[2],
  }));
}

/** mmdc を1回呼び出す。失敗時は原因を添えて中断する */
function runMmdc(args) {
  try {
    execFileSync(MMDC, args, { stdio: "pipe", env: { ...process.env } });
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`mmdc の実行に失敗しました: ${detail}`);
  }
}

function main() {
  if (!existsSync(MMDC)) {
    console.error(
      "mermaid-cli が見つかりません。次を実行してください:\n" +
        "  PUPPETEER_SKIP_DOWNLOAD=1 npm i --no-save @mermaid-js/mermaid-cli"
    );
    process.exit(1);
  }
  if (!existsSync(CHROME_PATH)) {
    console.error(
      `Chrome が見つかりません: ${CHROME_PATH}\n` +
        "CHROME_PATH に実行ファイルのパスを指定してください。"
    );
    process.exit(1);
  }

  const diagrams = extractDiagrams(readFileSync(README_PATH, "utf-8"));
  if (diagrams.length === 0) {
    console.error("README.md に <!-- diagram: 名前 --> 付きの mermaid ブロックがありません。");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  // mmdc に渡す puppeteer 設定（インストール済み Chrome を使う）
  const puppeteerConfigPath = join(TMP_DIR, "puppeteer.json");
  writeFileSync(
    puppeteerConfigPath,
    JSON.stringify({ executablePath: CHROME_PATH, args: ["--no-sandbox"] }, null, 2)
  );

  try {
    for (const { name, code } of diagrams) {
      const inputPath = join(TMP_DIR, `${name}.mmd`);
      writeFileSync(inputPath, code, "utf-8");

      const common = ["-i", inputPath, "-b", BACKGROUND, "-p", puppeteerConfigPath];
      runMmdc([...common, "-o", join(OUTPUT_DIR, `${name}.svg`), "-w", String(SVG_WIDTH)]);
      runMmdc([...common, "-o", join(OUTPUT_DIR, `${name}.png`), "-w", String(SVG_WIDTH), "-s", String(PNG_SCALE)]);

      console.log(`書き出し: assets/${name}.svg / assets/${name}.png`);
    }
  } finally {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

main();
