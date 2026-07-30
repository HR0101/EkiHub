// マーブル背景モジュール（装飾専用・任意読み込み）
//
// テーマカラー（--accent / --accent-2 / --accent-3）の縞をノイズで歪ませ、
// 大理石の脈のような層を既存の .aurora の上に重ねる。
//
// 装飾専用のため、次の方針で「読み込まれなくても困らない」ことを保証する。
//   - 読み込み順は最後。実行も requestIdleCallback で主要機能の後に回す
//   - 例外は握りつぶす。何も描かなくても既存のオーロラ背景が残る
//   - aria-hidden と pointer-events:none で支援技術・操作の妨げにしない
//   - prefers-reduced-motion では動かさず、高コントラストテーマでは表示しない
(() => {
  "use strict";

  const LAYER_ID = "marbleBackground-layer";
  const STYLE_ID = "marbleBackground-style";
  const GRADIENT_ID = "marbleBackground-veins";
  const FILTER_ID = "marbleBackground-filter";

  // 主要機能の描画を優先するため、暇になるまで生成を待つ時間の上限
  const IDLE_TIMEOUT_MS = 2500;
  // requestIdleCallback 非対応ブラウザ向けの遅延
  const FALLBACK_DELAY_MS = 500;

  // 内部座標系のサイズ。実画面の解像度でフィルタを計算すると数十msのフレーム落ちが出るため、
  // 小さく描いて引き伸ばす（ぼかした模様なので拡大による粗さは目立たない）。
  const CANVAS_WIDTH = 560;
  const CANVAS_HEIGHT = 320;

  // 大理石の脈を作るフィルタの調整値（すべて上の内部座標系での値）
  const NOISE_FREQUENCY = "0.02 0.042"; // 横へ流れる細かなうねりにする
  // オクターブ数が計算コストを最も左右する。3 にすると長いフレームが出るため 2 に留める。
  const NOISE_OCTAVES = 2;
  const NOISE_SEED = 17;
  const DISPLACE_SCALE = 56;            // 縞を歪ませる強さ＝マーブルらしさ
  const SOFTEN_DEVIATION = 1.4;         // 脈の輪郭をぼかして背景に溶かす

  // 縞の並び。[グラデーション上の位置(%), 色トーン] で、
  // 位置が近い組み合わせが細い脈として現れる。a/b/c は accent 系3色に対応する。
  const VEIN_STOPS = [
    [0, "a"], [6, "b"], [8, "c"], [10, "b"],
    [26, "a"], [40, "c"], [42, "a"],
    [58, "b"], [62, "c"], [64, "b"],
    [80, "a"], [92, "c"], [94, "a"], [100, "b"],
  ];

  const VEIN_STOPS_MARKUP = VEIN_STOPS
    .map(([offset, tone]) => `<stop class="mb-stop mb-stop--${tone}" offset="${offset}%" />`)
    .join("");

  const SVG_MARKUP = `
    <svg
      class="mb-canvas"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="${GRADIENT_ID}" x1="0%" y1="0%" x2="100%" y2="100%">
          ${VEIN_STOPS_MARKUP}
        </linearGradient>
        <filter
          id="${FILTER_ID}"
          x="-15%" y="-15%" width="130%" height="130%"
          color-interpolation-filters="sRGB"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="${NOISE_FREQUENCY}"
            numOctaves="${NOISE_OCTAVES}"
            seed="${NOISE_SEED}"
            result="mbNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="mbNoise"
            scale="${DISPLACE_SCALE}"
            xChannelSelector="R"
            yChannelSelector="G"
            result="mbVeins"
          />
          <feGaussianBlur in="mbVeins" stdDeviation="${SOFTEN_DEVIATION}" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#${GRADIENT_ID})" filter="url(#${FILTER_ID})" />
    </svg>
  `;

  const STYLE_CSS = `
    .mb-layer {
      position: fixed;
      /* 動かした際に端が見えないよう画面より一回り大きく取る */
      inset: -12%;
      z-index: 0;
      pointer-events: none;
      /* 明るいカラーテーマ（サクラ等）でも主張しすぎない濃さに抑える。
         背景の露出が大きいページは --mb-opacity で個別に下げられる。 */
      opacity: var(--mb-opacity, 0.19);
      /* 暗い背景には光として乗せる */
      mix-blend-mode: screen;
      will-change: transform;
      animation: mbDrift 46s ease-in-out infinite alternate;
    }

    .mb-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* 縞の色はテーマ変数を参照するので、カラーテーマ切替に自動で追従する */
    .mb-stop--a { stop-color: var(--accent); }
    .mb-stop--b { stop-color: var(--accent-2); }
    .mb-stop--c { stop-color: var(--accent-3); }

    @keyframes mbDrift {
      from { transform: translate3d(0, 0, 0) scale(1.04); }
      to   { transform: translate3d(-2.5%, 1.5%, 0) scale(1.12); }
    }

    /* ライトモードでは光として乗せると白飛びするため、色を沈める合成に変える */
    [data-mode="light"] .mb-layer {
      mix-blend-mode: multiply;
      opacity: var(--mb-opacity-light, 0.13);
    }

    /* 高コントラストは視覚ノイズを排除する方針（.aurora と揃える） */
    [data-color="high-contrast"] .mb-layer {
      display: none;
    }

    /* 動きに敏感な利用者には静止した模様として見せる */
    @media (prefers-reduced-motion: reduce) {
      .mb-layer {
        animation: none;
        transform: scale(1.04);
      }
    }
  `;

  // コアの injectStyle があれば使い、無ければ自前で <style> を作る。
  // （コアを読み込まないページでも単体で動くようにするため）
  function injectStyle(id, css) {
    const core = window.EkiHub;
    if (core && typeof core.injectStyle === "function") {
      core.injectStyle(id, css);
      return;
    }
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // 既存のオーロラ層のすぐ上に重ねる（コンテンツは .app の z-index で前面に残る）
  function mountLayer() {
    if (document.getElementById(LAYER_ID)) return;

    const layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.className = "mb-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = SVG_MARKUP;

    const aurora = document.querySelector(".aurora");
    if (aurora && aurora.parentNode) {
      aurora.parentNode.insertBefore(layer, aurora.nextSibling);
    } else if (document.body) {
      document.body.insertBefore(layer, document.body.firstChild);
    }
  }

  // 主要機能の描画・操作を妨げないよう、ブラウザが暇になってから生成する
  function schedule(task) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(task, FALLBACK_DELAY_MS);
    }
  }

  function init() {
    try {
      injectStyle(STYLE_ID, STYLE_CSS);
      mountLayer();
    } catch (error) {
      // 装飾だけなので、失敗しても既存の背景のまま何もしない
      if (window.console) console.warn("marbleBackground: 背景の生成に失敗しました", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => schedule(init), { once: true });
  } else {
    schedule(init);
  }
})();
