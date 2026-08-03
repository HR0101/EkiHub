"use client";

import { useEffect, useRef, useState } from "react";

import type { HistoryEntry } from "@/hooks/useSearchHistory";

interface Props {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onToggleFavorite: (id: string) => void;
  onRemove: (id: string) => void;
}

/** 過去に算出した条件を呼び戻す */
export function HistoryPanel({
  entries,
  onRestore,
  onToggleFavorite,
  onRemove,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="history" ref={wrapperRef}>
      <button
        type="button"
        className="tool-btn"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        履歴
        {entries.length > 0 && (
          <span className="history__count">{entries.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="history__panel" role="dialog" aria-label="算出履歴">
          {entries.length === 0 ? (
            <p className="history__empty">
              算出するとここに履歴が残ります。
            </p>
          ) : (
            <ul className="history__list">
              {entries.map((entry) => (
                <li className="history__item" key={entry.id}>
                  <button
                    type="button"
                    className="history__restore"
                    onClick={() => {
                      onRestore(entry);
                      setIsOpen(false);
                    }}
                  >
                    <span className="history__best">{entry.bestName}</span>
                    <span className="history__origins">
                      {entry.origins.map((origin) => origin.name).join("、")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`history__icon ${entry.isFavorite ? "is-active" : ""}`}
                    aria-label={
                      entry.isFavorite
                        ? "お気に入りから外す"
                        : "お気に入りに追加"
                    }
                    aria-pressed={entry.isFavorite}
                    onClick={() => onToggleFavorite(entry.id)}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="history__icon history__icon--remove"
                    aria-label="この履歴を削除"
                    onClick={() => onRemove(entry.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
