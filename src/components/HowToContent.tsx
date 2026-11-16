"use client";

import Link from "next/link";
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { HowToDemo } from "@/components/HowToDemo";
import { BackToHome } from "@/components/PageChrome";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { HowToEn } from "@/i18n/howto/en";
import { HowToJa } from "@/i18n/howto/ja";
import { HowToKo } from "@/i18n/howto/ko";
import { HowToZh } from "@/i18n/howto/zh";
import { HOWTO_TOUR } from "@/i18n/howto/tour";
import type { Locale } from "@/i18n";

const HOWTO_BY_LOCALE: Record<Locale, () => React.JSX.Element> = {
  ja: HowToJa, en: HowToEn, zh: HowToZh, ko: HowToKo,
};
const STEP_DURATION = 7000;
const STEP_COUNT = 5;
type TourState = { step: number; elapsed: number; playing: boolean; manual: boolean };
type TourAction = { type: "tick" } | { type: "toggle" } | { type: "pause" } | { type: "select"; step: number };

function advance(state: TourState, action: TourAction): TourState {
  if (action.type === "select") return { step: Math.max(0, Math.min(STEP_COUNT - 1, action.step)), elapsed: 0, playing: false, manual: true };
  if (action.type === "pause") return { ...state, playing: false };
  if (action.type === "toggle") {
    if (state.step === STEP_COUNT - 1 && state.elapsed >= STEP_DURATION)
      return { step: 0, elapsed: 0, playing: true, manual: false };
    return { ...state, playing: !state.playing, manual: false };
  }
  if (!state.playing) return state;
  const elapsed = state.elapsed + 100;
  if (elapsed < STEP_DURATION) return { ...state, elapsed };
  if (state.step === STEP_COUNT - 1) return { ...state, elapsed: STEP_DURATION, playing: false };
  return { ...state, step: state.step + 1, elapsed: 0 };
}
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getMotionPreference() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

export function HowToContent() {
  const { locale, t } = useTranslation();
  const copy = HOWTO_TOUR[locale];
  const Body = HOWTO_BY_LOCALE[locale];
  const [tour, dispatch] = useReducer(advance, { step: 0, elapsed: 0, playing: true, manual: false });
  const playerRef = useRef<HTMLElement>(null);
  const [playerVisible, setPlayerVisible] = useState(true);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionPreference, () => true);
  const playing = tour.playing && !reducedMotion;
  const panelId = useId();
  const headingId = useId();
  const finished = tour.step === STEP_COUNT - 1 && tour.elapsed >= STEP_DURATION;
  const current = copy.steps[tour.step]!;
  const progress = reducedMotion || tour.manual ? 1 : tour.elapsed / STEP_DURATION;

  useEffect(() => {
    if (!window.IntersectionObserver || !playerRef.current) return;
    const scene = playerRef.current.querySelector(".demo-stage > div");
    if (!scene) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPlayerVisible(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.2));
    }, { threshold: 0.2 });
    observer.observe(scene);
    return () => observer.disconnect();
  }, [tour.step]);

  useEffect(() => {
    if (!playing || !playerVisible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: "tick" });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, playerVisible]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) dispatch({ type: "pause" }); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  return (
    <>
      <div className="howto-topbar"><BackToHome /><LocaleToggle /></div>
      <header className="howto-header">
        <span className="howto-wordmark"><span className="howto-brand-mark" aria-hidden="true" />EkiHub <span>{t("nav.howto")}</span></span>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
      </header>

      <div className="howto-tour">
        <div className="tour-instructions">
          <nav aria-label={copy.navigation}>
            <ol className="tour-steps">
              {copy.steps.map((step, index) => (
                <li key={index}>
                  <button type="button" className={`tour-step ${tour.step === index ? "is-current" : ""}`} aria-current={tour.step === index ? "step" : undefined} aria-controls={panelId} aria-label={`${index + 1}. ${step.title}`} onClick={() => dispatch({ type: "select", step: index })}>
                    <span className="tour-step__number">{index + 1}</span><span className="tour-step__label">{step.title}</span><span className="tour-step__arrow" aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="tour-caption">
            <span className="tour-caption__count">{String(tour.step + 1).padStart(2, "0")} / 05</span>
            <h2 id={headingId}>{current.title}</h2>
            <p>{current.description}</p>
          </div>
          <div className="tour-controls">
            {!reducedMotion && <button type="button" className="tour-control tour-control--play" onClick={() => dispatch({ type: "toggle" })}><span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span>{playing ? copy.pause : finished ? copy.replay : copy.play}</button>}
            <button type="button" className="tour-control" aria-label={copy.previous} disabled={tour.step === 0} onClick={() => dispatch({ type: "select", step: tour.step - 1 })}>←</button>
            <button type="button" className="tour-control" aria-label={copy.next} disabled={tour.step === STEP_COUNT - 1} onClick={() => dispatch({ type: "select", step: tour.step + 1 })}>→</button>
          </div>
          {reducedMotion && <p className="tour-motion-note">{copy.reducedMotion}</p>}
        </div>

        <section ref={playerRef} id={panelId} className="tour-player" aria-labelledby={headingId}>
          <div className="tour-player__label"><span>{copy.demo}</span><span aria-hidden="true">{tour.step + 1} / 5</span></div>
          <HowToDemo key={tour.step} step={tour.step} progress={progress} animate={!reducedMotion && !tour.manual} />
          <div className="tour-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
          <p className="tour-tip">{current.tip}</p>
          <p className="tour-sample-note">{copy.sample}</p>
        </section>
      </div>

      <section className="howto-start">
        <h2>{copy.ready}</h2>
        <Link href="/" className="howto-start__link">{copy.start}<span aria-hidden="true">→</span></Link>
      </section>
      <details className="howto-full-guide"><summary>{copy.details}</summary><div className="howto-content"><Body /></div></details>
    </>
  );
}
