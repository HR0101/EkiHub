import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRailwayTitleMap,
  createOdptTrainInformationClient,
  normalizeTrainInformation
} from "../lib/odptTrainInformation.js";

const NOW = new Date("2026-07-29T03:00:00.000Z");

test("ODPT運行情報を表示用データへ正規化する", () => {
  const railwayRef = "odpt.Railway:TokyoMetro.Ginza";
  const titles = buildRailwayTitleMap([
    {
      "@id": railwayRef,
      "odpt:railwayTitle": { ja: "東京メトロ銀座線", en: "Ginza Line" }
    }
  ]);
  const items = normalizeTrainInformation(
    [
      {
        "@id": "alert",
        "odpt:railway": railwayRef,
        "dc:date": "2026-07-29T11:58:00+09:00",
        "dct:valid": "2026-07-29T12:15:00+09:00",
        "odpt:frequency": 30,
        "odpt:trainInformationStatus": { ja: "遅延" },
        "odpt:trainInformationText": { ja: "一部列車に遅れが出ています。" }
      },
      {
        "@id": "normal",
        "odpt:railway": "odpt.Railway:Example.Normal",
        "dc:date": "2026-07-29T11:59:00+09:00",
        "odpt:trainInformationText": "現在、平常どおり運転しています。"
      },
      {
        "@id": "expired",
        "odpt:railway": "odpt.Railway:Example.Expired",
        "dct:valid": "2026-07-29T11:00:00+09:00",
        "odpt:trainInformationText": "古い情報"
      }
    ],
    titles,
    NOW
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].id, "alert");
  assert.equal(items[0].railway, "東京メトロ銀座線");
  assert.equal(items[0].isNormal, false);
  assert.equal(items[0].refreshAfterSeconds, 30);
  assert.equal(items[1].railway, "Normal");
  assert.equal(items[1].isNormal, true);
});

test("遅延なし・本日の運行終了・異常を別の表示状態に分類する", () => {
  const items = normalizeTrainInformation(
    [
      {
        "@id": "no-delay",
        "odpt:railway": "odpt.Railway:Example.NoDelay",
        "odpt:trainInformationText": "現在、１５分以上の遅延はありません。"
      },
      {
        "@id": "ended",
        "odpt:railway": "odpt.Railway:Example.Ended",
        "odpt:trainInformationText": "本日の列車の運転は終了しました。"
      },
      {
        "@id": "suspended",
        "odpt:railway": "odpt.Railway:Example.Suspended",
        "odpt:trainInformationStatus": "運転見合わせ",
        "odpt:trainInformationText": "安全確認のため運転を見合わせています。"
      }
    ],
    new Map(),
    NOW
  );

  assert.equal(items.find((item) => item.id === "no-delay").serviceState, "normal");
  assert.equal(items.find((item) => item.id === "ended").serviceState, "ended");
  assert.equal(items.find((item) => item.id === "ended").isServiceEnded, true);
  assert.equal(items.find((item) => item.id === "suspended").serviceState, "alert");
});

test("クライアントはODPTレスポンスを更新間隔内でキャッシュする", async () => {
  const responses = {
    "odpt:TrainInformation": [
      {
        "@id": "normal",
        "odpt:railway": "odpt.Railway:Example.Line",
        "dc:date": "2026-07-29T11:59:00+09:00",
        "odpt:frequency": 45,
        "odpt:trainInformationText": "平常どおり運転しています。"
      }
    ],
    "odpt:Railway": [
      {
        "@id": "odpt.Railway:Example.Line",
        "odpt:railwayTitle": { ja: "サンプル線" }
      }
    ]
  };
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    const resource = String(url).includes("TrainInformation")
      ? "odpt:TrainInformation"
      : "odpt:Railway";
    return {
      ok: true,
      json: async () => responses[resource]
    };
  };
  const client = createOdptTrainInformationClient({
    token: "secret-token",
    fetchImpl,
    now: () => NOW
  });

  const first = await client.getTrainInformation();
  const second = await client.getTrainInformation();

  assert.equal(first.items[0].railway, "サンプル線");
  assert.equal(first.refreshAfterSeconds, 45);
  assert.equal(second, first);
  assert.equal(requested.length, 2);
  assert.ok(requested.every((url) => url.includes("acl%3AconsumerKey=secret-token")));
});

test("アクセストークン未設定時は設定エラーにする", async () => {
  const client = createOdptTrainInformationClient({ token: null });
  await assert.rejects(client.getTrainInformation(), { code: "ODPT_NOT_CONFIGURED" });
});
