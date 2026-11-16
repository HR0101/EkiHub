"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { searchStations, splitByMatch } from "@/lib/stationSearch";
import {
  MIN_INPUT_ROWS,
  useEkiHubStore,
  type StationInputRow as Row,
} from "@/stores/useEkiHubStore";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { Station } from "@/types/ekihub";

interface Props {
  row: Row;
  /** 表示上の番号（1始まり） */
  index: number;
  stations: readonly Station[];
}

/** 人数の入力範囲 */
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 10;

/** IME が打鍵を処理している間の keyCode（Safari は isComposing を立てないことがある） */
const IME_PROCESS_KEY_CODE = 229;

/** IME の変換中か。変換確定の Enter で候補を選ばないために使う */
function isComposingKey(event: React.KeyboardEvent<HTMLInputElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
}

/** 入力値が駅名と一字一句同じか（前後の空白は無視する） */
function isExactStationName(stations: readonly Station[], value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && stations.some((station) => station.name === trimmed);
}

/**
 * 駅名の入力欄1行。
 * 打鍵に合わせて候補を出し、先頭の候補を選択中として強調する。
 * ↑↓で選び直し、Enter で選択中の候補（既定は先頭）を確定、Escape で閉じる。
 * 駅名と一字一句同じになったら、その時点で選択済みとして候補を閉じる。
 */
export function StationInputRow({ row, index, stations }: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const rowCount = useEkiHubStore((state) => state.rows.length);
  const updateRow = useEkiHubStore((state) => state.updateRow);
  const removeRow = useEkiHubStore((state) => state.removeRow);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = row.name.trim();
  const matches = useMemo(
    () => (isOpen && query ? searchStations(stations, query) : []),
    [isOpen, query, stations]
  );
  const isListVisible = isOpen && matches.length > 0;
  // 候補の数が減って選択位置がはみ出したら先頭へ戻す
  const highlightedIndex =
    activeIndex >= 0 && activeIndex < matches.length ? activeIndex : 0;
  const optionId = (optionIndex: number) => `${listId}-option-${optionIndex}`;

  /** 入力値がそのまま駅マスタにあるか（枠線の色で伝える） */
  const validity = useMemo(() => {
    if (!query) return "empty" as const;
    return isExactStationName(stations, query)
      ? ("valid" as const)
      : ("invalid" as const);
  }, [query, stations]);

  // 欄の外をクリックしたら候補を閉じる
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  function closeSuggestions() {
    setIsOpen(false);
    setActiveIndex(0);
  }

  function commit(station: Station) {
    updateRow(row.id, { name: station.name });
    closeSuggestions();
  }

  /** 入力値の変化に合わせて、候補を開くか選択済みとして閉じるかを決める */
  function syncSuggestions(value: string, isComposing: boolean) {
    // IME の変換中は確定させない（変換候補を選んでいる途中のため）
    if (!isComposing && isExactStationName(stations, value)) {
      closeSuggestions();
      return;
    }
    setIsOpen(true);
    setActiveIndex(0);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (!isListVisible) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((highlightedIndex + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((highlightedIndex - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      // 変換確定の Enter は IME に任せる
      if (isComposingKey(event)) return;
      const picked = matches[highlightedIndex];
      if (picked) {
        // 候補を確定する Enter ではフォームを送信しない
        event.preventDefault();
        commit(picked);
      }
    }
  }

  const inputClass = [
    validity === "valid" ? "is-valid" : "",
    validity === "invalid" ? "is-invalid" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="input-row">
      <span className="input-row__index">{index}</span>

      <div className="input-row__field" ref={wrapperRef}>
        <input
          type="text"
          className={`js-station ${inputClass}`}
          value={row.name}
          placeholder={t("form.placeholder")}
          aria-label={`${t("form.stationLabel")} ${index}`}
          role="combobox"
          aria-expanded={isListVisible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={isListVisible ? optionId(highlightedIndex) : undefined}
          autoComplete="off"
          onChange={(event) => {
            const { value } = event.target;
            updateRow(row.id, { name: value });
            syncSuggestions(value, (event.nativeEvent as InputEvent).isComposing ?? false);
          }}
          onCompositionEnd={(event) => {
            // 変換を確定した時点で、駅名と一致していれば選択済みにする
            syncSuggestions(event.currentTarget.value, false);
          }}
          onFocus={(event) => {
            // 選択済みの欄に戻っただけなら候補は開かない
            if (!isExactStationName(stations, event.currentTarget.value)) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        <div
          id={listId}
          className={`suggest ${isListVisible ? "is-open" : ""}`}
          role="listbox"
        >
          {matches.map((station, i) => {
            const parts = splitByMatch(station.name, query);
            return (
              <div
                key={station.name}
                id={optionId(i)}
                className={`suggest__item ${i === highlightedIndex ? "is-active" : ""}`}
                role="option"
                aria-selected={i === highlightedIndex}
                onMouseEnter={() => setActiveIndex(i)}
                // input の blur より先に確定させるため mousedown で拾う
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(station);
                }}
              >
                <span className="suggest__main">
                  <span>
                    {parts.before}
                    {parts.match && (
                      <mark className="suggest__hl">{parts.match}</mark>
                    )}
                    {parts.after}
                  </span>
                  {station.isMajor && (
                    <span className="suggest__major">{t("result.majorStation")}</span>
                  )}
                </span>
                <span className="suggest__sub">
                  {station.kana}
                  {station.lines.length > 0 && (
                    <>
                      <span className="suggest__dot"> ・ </span>
                      {station.lines.slice(0, 3).join("、")}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <select
        className="input-row__people js-people"
        value={row.people}
        title={t("form.peopleLabel")}
        aria-label={`${t("form.stationLabel")} ${index} — ${t("form.peopleLabel")}`}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          updateRow(row.id, {
            people: Number.isFinite(parsed)
              ? Math.min(PEOPLE_MAX, Math.max(PEOPLE_MIN, parsed))
              : PEOPLE_MIN,
          });
        }}
      >
        {Array.from({ length: PEOPLE_MAX }, (_, index) => index + 1).map((people) => (
          <option key={people} value={people}>{t("form.peopleCount", { count: people })}</option>
        ))}
      </select>

      <button
        type="button"
        className="input-row__remove"
        aria-label={t("form.remove")}
        title={t("form.remove")}
        disabled={rowCount <= MIN_INPUT_ROWS}
        onClick={() => removeRow(row.id)}
      >
        ×
      </button>
    </div>
  );
}
