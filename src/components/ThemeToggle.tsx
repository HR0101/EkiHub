"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DESIGN_THEMES,
  applyDesignTheme,
  readDesignTheme,
  type DesignTheme,
} from "@/lib/designTheme";

export function ThemeToggle() {
  const { t } = useTranslation();
  const [design, setDesign] = useState<DesignTheme | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    const id = readDesignTheme();
    applyDesignTheme(id);
    // Read the pre-paint choice without changing it on route remounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(id);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function outside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [isOpen]);

  return (
    <div className="theme-toggle" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="tool-btn"
        aria-label={t("theme.button")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        {t("theme.button")}
        {design && (
          <span className="design-picker__current" aria-hidden="true">
            {
              DESIGN_THEMES.find((theme) => theme.id === design)?.name.split(
                " / ",
              )[0]
            }
          </span>
        )}
      </button>
      {isOpen && (
        <div
          id={panelId}
          className="theme-toggle__panel"
          role="dialog"
          aria-label={t("theme.dialogLabel")}
        >
          <p className="design-picker__note">{t("theme.randomHint")}</p>
          <div className="design-picker__options">
            {DESIGN_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                aria-label={theme.name}
                className={`theme-toggle__option design-picker__option ${design === theme.id ? "is-active" : ""}`}
                aria-pressed={design === theme.id}
                onClick={() => {
                  applyDesignTheme(theme.id);
                  setDesign(theme.id);
                }}
              >
                <span
                  className={`design-preview design-preview--${theme.id}`}
                  aria-hidden="true"
                >
                  <span className="design-preview__heading" />
                  <span className="design-preview__workspace">
                    <span className="design-preview__form">
                      <i />
                      <i />
                      <b />
                    </span>
                    <span className="design-preview__result">
                      <i />
                      <b />
                      <i />
                    </span>
                  </span>
                </span>
                <span className="design-picker__name">{theme.name}</span>
                <span className="design-picker__check" aria-hidden="true">
                  {design === theme.id ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
