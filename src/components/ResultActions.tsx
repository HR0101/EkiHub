"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { buildShareUrl } from "@/lib/shareUrl";
import { buildSummaryText } from "@/lib/summary";
import { useEkiHubStore } from "@/stores/useEkiHubStore";
import type { RankingEntry } from "@/types/ekihub";

interface Props {
  station: RankingEntry;
}

/** QRコードの一辺（px） */
const QR_SIZE = 180;

/** 結果カード下のアクション列。共有・コピー・印刷をまとめる */
export function ResultActions({ station }: Props) {
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
        title: "EkiHub — みんなの中心駅",
        text: `集合駅の候補: ${station.name}`,
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
        {urlCopy.status === "copied"
          ? "コピーしました"
          : urlCopy.status === "failed"
            ? "コピーできません"
            : "URLをコピー"}
      </button>

      {canWebShare && (
        <button type="button" className="tool-btn" onClick={() => void handleWebShare()}>
          共有
        </button>
      )}

      <button
        type="button"
        className="tool-btn"
        aria-expanded={isQrOpen}
        onClick={() => setIsQrOpen((current) => !current)}
      >
        QR
      </button>

      <button
        type="button"
        className="tool-btn"
        onClick={() => void summaryCopy.copy(buildSummaryText(station))}
      >
        {summaryCopy.status === "copied"
          ? "コピーしました"
          : summaryCopy.status === "failed"
            ? "コピーできません"
            : "結果をコピー"}
      </button>

      <button type="button" className="tool-btn" onClick={() => window.print()}>
        印刷
      </button>

      {isQrOpen && (
        <div className="qr-panel">
          {qrDataUrl ? (
            // next/image は data URL を最適化できないため通常の img を使う
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="この条件を開く共有リンクのQRコード"
              width={QR_SIZE}
              height={QR_SIZE}
            />
          ) : (
            <p className="qr-panel__note">QRコードを準備しています…</p>
          )}
          <p className="qr-panel__note">
            スマートフォンで読み取ると、同じ条件で開けます。
          </p>
        </div>
      )}
    </div>
  );
}
