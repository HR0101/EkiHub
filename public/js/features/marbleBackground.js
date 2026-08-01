// 流動背景モジュール（装飾専用・任意読み込み）
//
// ぼかした色の塊（ブロブ）を重ね、混ざり合いながら流れる背景を作る。
// 円形の要素へ斜めのグラデーションを塗り、blur でぼかす構成。
//
// 指定仕様は 1.2W / 1.3W / 1.0W の3枚構成だったが、
// 粒度を細かくするため 1枚あたりを小さくして枚数を増やしている。
// サイズに対する ぼかし量の比率（約12.5%）と色・グラデーション角度は仕様どおり。
//
// 配置は仕様の考え方を踏襲し、画面中央を原点として
// 2点を結ぶ線分上の1点（係数は乱数）に置く。線分自体も粒ごとに抽選する。
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

  // 主要機能の描画を優先するため、暇になるまで生成を待つ時間の上限
  const IDLE_TIMEOUT_MS = 2500;
  // requestIdleCallback 非対応ブラウザ向けの遅延
  const FALLBACK_DELAY_MS = 500;

  const GRAIN_COUNT = 30;
  // 画面幅に対する粒の直径(%)。
  // 大小を混ぜることで、大きな粒が下地の色を作り、小さな粒が
  // 局所的な色の変化を足して「細かい混ざり合い」になる。
  // 個々が「点」として見えないよう、下限も隣と重なる大きさに保つ。
  const SIZE_MIN = 12;
  const SIZE_MAX = 44;
  // ぼかし量は直径に対する比率。mask のフェードと合わせて輪郭を完全に消す。
  const BLUR_RATIO = 0.18;
  // 中心からの散らばり（画面幅・高さに対する倍率）。
  // 広げすぎると粒が孤立して点に見えるため、重なりを保てる範囲に抑える。
  const SPREAD_X = 0.45;
  const SPREAD_Y = 0.45;
  // 一周の秒数の範囲。粒ごとにばらけさせて全体の周期を感じさせない。
  // 長すぎると動いて見えないため、20〜35秒に収める。
  const DURATION_MIN = 19;
  const DURATION_MAX = 34;
  // 軌道パターンの数（CSSの @keyframes と対応）
  const TRACK_VARIANTS = 4;
  // 色の種類（CSSの --mb-grain-* と対応）
  const TONE_VARIANTS = 3;

  const STYLE_CSS = `
    .mb-layer {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
      /* 背景色そのものが揺らいで見えるようにするため、加算や乗算ではなく
         通常合成で「背景に近い色」を敷く。
         色を上に乗せる合成にすると、黒／白の地からテーマ色が浮いてしまう。 */
      opacity: var(--mb-opacity, 1);
      mix-blend-mode: normal;
    }

    [data-mode="light"] .mb-layer {
      opacity: var(--mb-opacity-light, 1);
    }

    /* 粒の色は「地の色（--bg-base）にテーマのアクセントをわずかに混ぜたもの」。
       アクセントをそのまま置くと黒／白の地から色が浮いて主張が強くなるため、
       混ぜる割合を1割前後に抑え、近い色どうしの濃淡として流す。
       カラーテーマを変えれば混ざる色相も変わる。
       1行目は color-mix 非対応環境向けのフォールバック（地の色のみ）。 */
    .mb-layer {
      --mb-grain-1: linear-gradient(135deg, var(--bg-base), var(--bg-base));
      --mb-grain-1: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent-2) 20%, var(--bg-base)),
        color-mix(in srgb, var(--accent) 11%, var(--bg-base))
      );
      --mb-grain-2: linear-gradient(135deg, var(--bg-base), var(--bg-base));
      --mb-grain-2: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent-3) 14%, var(--bg-base)),
        color-mix(in srgb, var(--accent-2) 18%, var(--bg-base))
      );
      --mb-grain-3: linear-gradient(45deg, var(--bg-base), var(--bg-base));
      --mb-grain-3: linear-gradient(
        45deg,
        color-mix(in srgb, var(--accent) 17%, var(--bg-base)),
        color-mix(in srgb, var(--accent-3) 9%, var(--bg-base))
      );
    }

    /* ライトは地が明るいぶん、同じ割合でも色が立ちやすいので控えめにする */
    [data-mode="light"] .mb-layer {
      --mb-grain-1: linear-gradient(135deg, var(--bg-base), var(--bg-base));
      --mb-grain-1: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent) 13%, var(--bg-base)),
        color-mix(in srgb, var(--accent-2) 8%, var(--bg-base))
      );
      --mb-grain-2: linear-gradient(135deg, var(--bg-base), var(--bg-base));
      --mb-grain-2: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent-3) 12%, var(--bg-base)),
        color-mix(in srgb, var(--accent) 9%, var(--bg-base))
      );
      --mb-grain-3: linear-gradient(45deg, var(--bg-base), var(--bg-base));
      --mb-grain-3: linear-gradient(
        45deg,
        color-mix(in srgb, var(--accent-2) 11%, var(--bg-base)),
        color-mix(in srgb, var(--accent-3) 7%, var(--bg-base))
      );
    }

    .mb-grain {
      position: absolute;
      left: 50%;
      top: 50%;
      aspect-ratio: 1;
      will-change: transform;
      /* 円形に切り抜くと輪郭が「点」として見えてしまうため、
         中心から外へ徐々に透明になるマスクでにじませ、隣の粒と溶け合わせる。
         グラデーションの角度と色は background 側（仕様どおり）が保持される。 */
      -webkit-mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
      mask-image: radial-gradient(circle at 50% 50%, #000 18%, transparent 70%);
      /* 位置(--mb-x/--mb-y)・サイズ・ぼかし・周期は marbleBackground.js が与える */
    }

    .mb-grain--tone1 { background: var(--mb-grain-1); }
    .mb-grain--tone2 { background: var(--mb-grain-2); }
    .mb-grain--tone3 { background: var(--mb-grain-3); }

    /* 軌道は4種を使い回し、周期と開始位相を粒ごとにずらして重なりを常に変える。
       translate の % は「粒自身の直径」基準なので、粒が小さいと移動量も小さくなる。
       画面上でしっかり流れて見えるよう、直径と同程度（100%前後）動かす。 */
    @keyframes mbTrack1 {
      0%   { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
      33%  { transform: translate(calc(-50% + var(--mb-x) + 105%), calc(-50% + var(--mb-y) - 80%)) scale(1.3); }
      66%  { transform: translate(calc(-50% + var(--mb-x) - 75%), calc(-50% + var(--mb-y) + 95%)) scale(0.85); }
      100% { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
    }

    @keyframes mbTrack2 {
      0%   { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
      33%  { transform: translate(calc(-50% + var(--mb-x) - 115%), calc(-50% + var(--mb-y) + 70%)) scale(0.8); }
      66%  { transform: translate(calc(-50% + var(--mb-x) + 85%), calc(-50% + var(--mb-y) + 110%)) scale(1.35); }
      100% { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
    }

    @keyframes mbTrack3 {
      0%   { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
      33%  { transform: translate(calc(-50% + var(--mb-x) + 60%), calc(-50% + var(--mb-y) + 125%)) scale(1.2); }
      66%  { transform: translate(calc(-50% + var(--mb-x) + 130%), calc(-50% + var(--mb-y) - 60%)) scale(0.9); }
      100% { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
    }

    @keyframes mbTrack4 {
      0%   { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
      33%  { transform: translate(calc(-50% + var(--mb-x) - 95%), calc(-50% + var(--mb-y) - 105%)) scale(1.25); }
      66%  { transform: translate(calc(-50% + var(--mb-x) + 50%), calc(-50% + var(--mb-y) - 130%)) scale(0.95); }
      100% { transform: translate(calc(-50% + var(--mb-x)), calc(-50% + var(--mb-y))) scale(1); }
    }

    .mb-grain--track1 { animation-name: mbTrack1; }
    .mb-grain--track2 { animation-name: mbTrack2; }
    .mb-grain--track3 { animation-name: mbTrack3; }
    .mb-grain--track4 { animation-name: mbTrack4; }

    .mb-grain {
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
    }

    /* 高コントラストは視覚ノイズを排除する方針（.aurora と揃える） */
    [data-color="high-contrast"] .mb-layer {
      display: none;
    }

    /* 動きに敏感な利用者には静止した模様として見せる */
    @media (prefers-reduced-motion: reduce) {
      .mb-grain {
        animation: none;
      }
    }
  `;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(from, to, t) {
    return from + (to - from) * t;
  }

  // 粒1つを作る。位置は「乱数で決めた2点を結ぶ線分上の1点」に置く。
  function createGrain(index) {
    const grain = document.createElement("span");
    const track = (index % TRACK_VARIANTS) + 1;
    const tone = (index % TONE_VARIANTS) + 1;
    grain.className = `mb-grain mb-grain--track${track} mb-grain--tone${tone}`;

    const size = randomBetween(SIZE_MIN, SIZE_MAX);
    grain.style.width = `${size.toFixed(2)}%`;

    // 線分の両端を抽選し、その上の1点を選ぶ
    const from = [randomBetween(-SPREAD_X, SPREAD_X), randomBetween(-SPREAD_Y, SPREAD_Y)];
    const to = [randomBetween(-SPREAD_X, SPREAD_X), randomBetween(-SPREAD_Y, SPREAD_Y)];
    const t = Math.random();
    grain.dataset.mbX = lerp(from[0], to[0], t).toFixed(4);
    grain.dataset.mbY = lerp(from[1], to[1], t).toFixed(4);

    grain.style.animationDuration = `${randomBetween(DURATION_MIN, DURATION_MAX).toFixed(1)}s`;
    // 負の遅延で開始位相をずらし、読み込み直後に全粒が揃って動くのを避ける
    grain.style.animationDelay = `${-randomBetween(0, DURATION_MAX).toFixed(1)}s`;
    return grain;
  }

  // 画面サイズから粒の位置とぼかし量を確定する（リサイズ時も呼ぶ）
  function layoutGrains(layer) {
    const width = layer.offsetWidth;
    const height = layer.offsetHeight;
    if (!width || !height) return;

    layer.querySelectorAll(".mb-grain").forEach((grain) => {
      const x = parseFloat(grain.dataset.mbX) * width;
      const y = parseFloat(grain.dataset.mbY) * height;
      grain.style.setProperty("--mb-x", `${x.toFixed(1)}px`);
      grain.style.setProperty("--mb-y", `${y.toFixed(1)}px`);
      // 直径は width(%) 指定なので、実寸から ぼかし量を求める
      grain.style.filter = `blur(${(grain.offsetWidth * BLUR_RATIO).toFixed(1)}px)`;
    });
  }

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
    if (document.getElementById(LAYER_ID)) return null;

    const layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.className = "mb-layer";
    layer.setAttribute("aria-hidden", "true");

    const aurora = document.querySelector(".aurora");
    if (aurora && aurora.parentNode) {
      aurora.parentNode.insertBefore(layer, aurora.nextSibling);
    } else if (document.body) {
      document.body.insertBefore(layer, document.body.firstChild);
    } else {
      return null;
    }

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < GRAIN_COUNT; i += 1) {
      fragment.appendChild(createGrain(i));
    }
    layer.appendChild(fragment);
    layoutGrains(layer);
    return layer;
  }

  function observeResize(layer) {
    if (typeof ResizeObserver !== "function") {
      window.addEventListener("resize", () => layoutGrains(layer));
      return;
    }
    new ResizeObserver(() => layoutGrains(layer)).observe(layer);
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
      const layer = mountLayer();
      if (layer) observeResize(layer);
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
