"use client";

import type { CSSProperties } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { HOWTO_TOUR } from "@/i18n/howto/tour";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function Pointer({ x, y }: { x: number; y: number }) {
  return (
    <div className="demo-pointer" style={{ transform: `translate(${x}%, ${y}%)` }}>
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
        <path d="M3 2v25l7-7 5 10 5-3-5-9h10L3 2Z" fill="#29223a" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A local, illustrative product view: it never changes the actual search. */
export function HowToDemo({ step, progress, animate = true }: { step: number; progress: number; animate?: boolean }) {
  const { locale, t } = useTranslation();
  const copy = HOWTO_TOUR[locale];
  const [originA, originB, best, alternative] = copy.stationNames;
  const typed = originA.slice(0, Math.ceil(clamp((progress - 0.08) / 0.25) * originA.length));
  const confirmed = progress >= 0.5;
  const secondReady = progress >= 0.72;
  const allStations = progress >= 0.5;
  const weight = 0.35 + clamp((progress - 0.15) / 0.55) * 0.45;
  const selectedOther = progress >= 0.62;
  const copied = progress >= 0.5;
  const chosen = step === 4 || selectedOther ? alternative : best;

  return (
    <div className={`demo-screen ${animate ? "demo-screen--animated" : ""}`} role="img" aria-label={`${copy.demo}: ${copy.steps[step]!.description}`}>
      <div aria-hidden="true">
        <div className="demo-screen__bar">
          <span className="demo-wordmark"><span className="howto-brand-mark" /> EkiHub</span>
          <span className="demo-screen__counter">{String(step + 1).padStart(2, "0")} / 05</span>
        </div>
        <div className={`demo-stage demo-stage--${step}`}>
          {step === 0 && (
            <div className="demo-form">
              <div className="demo-heading">{t("form.panelTitle")}</div>
              <div className="demo-field-labels"><span>{t("form.stationLabel")}</span><span>{t("form.peopleLabel")}</span></div>
              <div className="demo-input-row">
                <span className="demo-index">1</span>
                <div className={`demo-input ${!confirmed ? "is-focused" : ""}`}>
                  {confirmed ? originA : typed || <span className="demo-placeholder">{t("form.placeholder")}</span>}
                  {!confirmed && typed && <span className="demo-caret" />}
                  {confirmed && <span className="demo-check">✓</span>}
                </div>
                <span className="demo-people">{t("form.peopleCount", { count: 1 })}</span>
              </div>
              <div className="demo-input-row">
                <span className="demo-index">2</span>
                <div className={`demo-input ${confirmed && !secondReady ? "is-focused" : ""}`}>
                  {secondReady ? originB : <span className="demo-placeholder">{t("form.placeholder")}</span>}
                  {secondReady && <span className="demo-check">✓</span>}
                </div>
                <span className="demo-people">{t("form.peopleCount", { count: 1 })}</span>
              </div>
              {progress >= 0.22 && !confirmed && (
                <div className="demo-suggestion">
                  <strong>{originA}</strong><span>{copy.suggestion}</span>
                </div>
              )}
              <div className="demo-add">{t("form.addStation")}</div>
              <div className={`demo-submit ${secondReady ? "is-ready" : ""}`}>{t("form.submit")} <span>→</span></div>
              <Pointer x={confirmed ? 55 : 44} y={confirmed ? 47 : 29} />
            </div>
          )}
          {step === 1 && (
            <div className="demo-modes">
              <div className="demo-heading">{t("form.modeTitle")}</div>
              {[false, true].map((all) => (
                <div key={String(all)} className={`demo-choice ${allStations === all ? "is-selected" : ""}`}>
                  <span className="demo-radio" />
                  <div><strong>{t(all ? "form.modeBMain" : "form.modeAMain")}</strong><p>{t(all ? "form.modeBSub" : "form.modeASub")}</p></div>
                </div>
              ))}
              <div className={`demo-station-strip ${allStations ? "has-local" : ""}`}>
                <i /><span>{originA}</span><i className="demo-local" /><i className="demo-local" /><span>{originB}</span><i />
              </div>
              <Pointer x={76} y={allStations ? 53 : 25} />
            </div>
          )}
          {step === 2 && (
            <div className="demo-preferences">
              <div className="demo-heading">{t("form.preferences")} <span>⌃</span></div>
              <div className="demo-slider-heading"><strong>{t("form.weightTitle")}</strong><span>{t(weight > 0.65 ? "form.weightLabels.fairer" : "form.weightLabels.balanced")}</span></div>
              <div className="demo-slider" style={{ "--demo-weight": weight } as CSSProperties}>
                <div className="demo-slider__fill" /><div className="demo-slider__position"><i /></div>
              </div>
              <div className="demo-slider-labels"><span>{t("form.weightNear")}</span><span>{t("form.weightFair")}</span></div>
              <div className="demo-fare"><span>{t("form.fareTitle")}</span><strong>{t(progress > 0.75 ? "form.fareLabels.mid" : "form.fareLabels.low")}</strong></div>
              <div className={`demo-submit is-ready ${progress >= 0.88 ? "is-pressed" : ""}`}>{t(progress >= 0.9 && progress < 1 ? "form.computing" : "form.submit")} <span>→</span></div>
              <Pointer x={progress >= 0.82 ? 76 : 17 + weight * 62} y={progress >= 0.82 ? 87 : 33} />
            </div>
          )}
          {step === 3 && (
            <div className="demo-comparison">
              <div className="demo-result-label">{t(selectedOther ? "result.eyebrowSelected" : "result.eyebrowBest")}</div>
              <div className="demo-station-name" key={chosen}>{chosen}</div>
              <svg className="demo-route" viewBox="0 0 420 155">
                <path d="M65 30C65 105 210 55 210 115M355 30C355 105 210 55 210 115" pathLength="1" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="1" strokeDashoffset={1 - clamp(progress * 3)} />
                <circle cx="65" cy="30" r="7" fill="white" stroke="var(--text-main)" strokeWidth="2" />
                <circle cx="355" cy="30" r="7" fill="white" stroke="var(--text-main)" strokeWidth="2" />
                <circle cx="210" cy="115" r="12" fill="var(--accent-soft)" stroke="var(--text-main)" strokeWidth="3" />
                <text x="65" y="16" textAnchor="middle">{originA}</text><text x="355" y="16" textAnchor="middle">{originB}</text>
                <text x="210" y="150" textAnchor="middle">{chosen}</text>
              </svg>
              <div className="demo-metrics"><div><strong>{selectedOther ? "38" : "37"}</strong><span>{t("result.avgMinutes")}</span></div><div><strong>±{selectedOther ? "4.5" : "2"}</strong><span>{t("result.fairness")}</span></div></div>
              <div className="demo-ranking">
                {[best, alternative].map((name, index) => (
                  <div key={name} className={`demo-rank ${selectedOther === Boolean(index) ? "is-selected" : ""}`}><span>{index + 1}</span><strong>{name}</strong><span>{t("travel.minutes", { count: index === 0 ? 37 : 38 })}</span><span>↗</span></div>
                ))}
              </div>
              <Pointer x={72} y={selectedOther ? 89 : 76} />
            </div>
          )}
          {step === 4 && (
            <div className="demo-share">
              <div className="demo-result-label">{t("result.eyebrowSelected")}</div>
              <div className="demo-station-name">{alternative}</div>
              <div className="demo-share-url"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m10 13 4-4m-7 6-1 1a4 4 0 0 0 6 6l4-4a4 4 0 0 0 0-6m-2-3 1-1a4 4 0 0 0-6-6L5 6a4 4 0 0 0 0 6" transform="translate(1 -1)" stroke="currentColor" strokeWidth="1.5" /></svg><span>ekihub.jp/results?o=…</span></div>
              <div className={`demo-copy ${copied ? "is-copied" : ""}`}>{copied ? "✓ " : ""}{t(copied ? "actions.copied" : "actions.copyUrl")}</div>
              <div className={`demo-share-note ${copied ? "is-visible" : ""}`}>{copy.copyHint}</div>
              <div className="demo-extra"><span>{t("actions.more")}</span><span>{t("actions.qr")}</span><span>{t("actions.copySummary")}</span></div>
              <Pointer x={61} y={55} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
