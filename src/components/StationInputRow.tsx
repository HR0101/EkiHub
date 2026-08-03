"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { searchStations, splitByMatch } from "@/lib/stationSearch";
import {
  MIN_INPUT_ROWS,
  useEkiHubStore,
  type StationInputRow as Row,
} from "@/stores/useEkiHubStore";
import type { Station } from "@/types/ekihub";

interface Props {
  row: Row;
  /** 表示上の番号（1始まり） */
  index: number;
  stations: readonly Station[];
}

/** 人数の入力範囲 */
const PEOPLE_MIN = 1;
const PEOPLE_MAX = 99;

/**
 * 駅名の入力欄1行。
 * 打鍵に合わせて候補を出し、↑↓で選んで Enter か Escape で閉じる。
 */
export function StationInputRow({ row, index, stations }: Props) {
  const listId = useId();
  const rowCount = useEkiHubStore((state) => state.rows.length);
  const updateRow = useEkiHubStore((state) => state.updateRow);
  const removeRow = useEkiHubStore((state) => state.removeRow);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = row.name.trim();
  const matches = useMemo(
    () => (isOpen && query ? searchStations(stations, query) : []),
    [isOpen, query, stations]
  );

  /** 入力値がそのまま駅マスタにあるか（枠線の色で伝える） */
  const validity = useMemo(() => {
    if (!query) return "empty" as const;
    return stations.some((station) => station.name === query)
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

  function commit(station: Station) {
    updateRow(row.id, { name: station.name });
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!isOpen || matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + matches.length) % matches.length
      );
    } else if (event.key === "Enter") {
      const picked = matches[activeIndex];
      if (picked) {
        // 候補を選んでいる間はフォーム送信させない
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
          placeholder="例）新宿、横浜、大宮…"
          aria-label={`最寄駅 ${index}`}
          role="combobox"
          aria-expanded={isOpen && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => {
            updateRow(row.id, { name: event.target.value });
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />

        <div
          id={listId}
          className={`suggest ${isOpen && matches.length > 0 ? "is-open" : ""}`}
          role="listbox"
        >
          {matches.map((station, i) => {
            const parts = splitByMatch(station.name, query);
            return (
              <div
                key={station.name}
                className={`suggest__item ${i === activeIndex ? "is-active" : ""}`}
                role="option"
                aria-selected={i === activeIndex}
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
                    <span className="suggest__major">主要駅</span>
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

      <input
        type="number"
        className="input-row__people js-people"
        min={PEOPLE_MIN}
        max={PEOPLE_MAX}
        value={row.people}
        title="この駅から来る人数"
        aria-label={`最寄駅 ${index} の人数`}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          updateRow(row.id, {
            people: Number.isFinite(parsed)
              ? Math.min(PEOPLE_MAX, Math.max(PEOPLE_MIN, parsed))
              : PEOPLE_MIN,
          });
        }}
      />

      <button
        type="button"
        className="input-row__remove"
        aria-label="この駅を削除"
        title="この駅を削除"
        disabled={rowCount <= MIN_INPUT_ROWS}
        onClick={() => removeRow(row.id)}
      >
        ×
      </button>
    </div>
  );
}
