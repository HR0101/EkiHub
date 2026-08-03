"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { buildShareUrl } from "@/lib/shareUrl";
import { buildSummaryText } from "@/lib/summary";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useEkiHubStore } from "@/stores/useEkiHubStore";
import type { RankingEntry } from "@/types/ekihub";

interface Props {
  station: RankingEntry;
}

/** QRコードの一辺（px） */
const QR_SIZE = 180;

/** 結果カード下のアクション列。共有・コピー・印刷をまとめる */
export function ResultActions({ station }: Props) {
  const { t } = useTranslation();
  const rows = useEkiHubStore((state) => state.rows);
  const mode = useEkiHubStore((state) => state.mode);
  const fairnessWeight = useEkiHubStore((state) => state.fairnessWeight);
  const fareWeight = useEkiHubStore((state) => state.fareWeight);

  const urlCopy = useCopyToClipboard();
  const summaryCopy = useCopyToClipboard();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [canWebShare, setCanWebShare] = useState(false);

  // navigator.share はサーバーで参照できないため、マウント後に判定する
  useEffect(() => {
    setCanWebShare(typeof navigator.share === "function");
  }, []);

  function currentShareUrl(): string {
    return buildShareUrl({
      origins: rows
        .filter((row) => row.name.trim().length > 0)
        .map((row) => ({ name: row.name.trim(), people: row.people })),
      mode,
      fairnessWeight,
      fareWeight,
    });
  }

  // QRは開いた時にだけ作る（閉じている間は生成コストを払わない）
  useEffect(() => {
    if (!isQrOpen) return;
    let cancelled = false;
    QRCode.toDataURL(currentShareUrl(), { width: QR_SIZE, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((error: unknown) => {
        console.error("QRコードの生成に失敗しました", error);
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // 条件が変わったら作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQrOpen, rows, mode, fairnessWeight, fareWeight]);

  async function handleWebShare() {
    try {
      await navigator.share({
        title: t("actions.shareTitle"),
        text: t("actions.shareText", { name: station.name }),
        url: currentShareUrl(),
      });
    } catch {
      // 利用者が共有シートを閉じた場合もここに来るため、何も表示しない
    }
  }

  return (
    <div className="hero-actions">
      <button
        type="button"
        className="tool-btn"
        onClick={() => void urlCopy.copy(currentShareUrl())}
      >
        {t(
          urlCopy.status === "copied"
            ? "actions.copied"
            : urlCopy.status === "failed"
              ? "actions.copyFailed"
              : "actions.copyUrl"
        )}
      </button>

      {canWebShare && (
        <button type="button" className="tool-btn" onClick={() => void handleWebShare()}>
          {t("actions.share")}
        </button>
      )}

      <button
        type="button"
        className="tool-btn"
        aria-expanded={isQrOpen}
        onClick={() => setIsQrOpen((current) => !current)}
      >
        {t("actions.qr")}
      </button>

      <button
        type="button"
        className="tool-btn"
        onClick={() => void summaryCopy.copy(buildSummaryText(station))}
      >
        {t(
          summaryCopy.status === "copied"
            ? "actions.copied"
            : summaryCopy.status === "failed"
              ? "actions.copyFailed"
              : "actions.copySummary"
        )}
      </button>

      <button type="button" className="tool-btn" onClick={() => window.print()}>
        {t("actions.print")}
      </button>

      {isQrOpen && (
        <div className="qr-panel">
          {qrDataUrl ? (
            // next/image は data URL を最適化できないため通常の img を使う
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={t("actions.qrAlt")}
              width={QR_SIZE}
              height={QR_SIZE}
            />
          ) : (
            <p className="qr-panel__note">{t("actions.qrPreparing")}</p>
          )}
          <p className="qr-panel__note">{t("actions.qrNote")}</p>
        </div>
      )}
    </div>
  );
}
