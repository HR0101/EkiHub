import { beforeEach, expect, it, vi } from "vitest";

import { POST } from "../app/api/center/route";
import { computeCenterStation } from "../lib/centerLogic.js";
import { loadStationIndex, loadStations } from "@/server/stationRepository";
import type { Station } from "@/types/ekihub";

vi.mock("@/server/stationRepository", () => ({
  loadStations: vi.fn(),
  loadStationIndex: vi.fn(),
}));
vi.mock("../lib/centerLogic.js", () => ({ computeCenterStation: vi.fn() }));

/** テスト用の駅（座標は実際の位置に近い値） */
function station(name: string, lat: number, lng: number, originalName?: string): Station {
  return { name, kana: "", lat, lng, lines: [], isMajor: false, ...(originalName ? { originalName } : {}) };
}

const HIYOSHI = station("日吉(神奈川)", 35.5539, 139.6469, "日吉");
const SHINJUKU = station("新宿", 35.6897, 139.7005);

/** POST /api/center へ送るリクエストを作る */
function request(origins: string[]): Request {
  return new Request("http://localhost/api/center", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origins, mode: "B" }),
  });
}

beforeEach(() => {
  vi.mocked(loadStations).mockResolvedValue([HIYOSHI, SHINJUKU]);
  // 読み替え表を反映した索引: 旧駅名「日吉」も日吉(神奈川)を指す
  vi.mocked(loadStationIndex).mockResolvedValue(
    new Map([
      ["日吉(神奈川)", HIYOSHI],
      ["日吉", HIYOSHI],
      ["新宿", SHINJUKU],
    ]),
  );
  vi.mocked(computeCenterStation).mockResolvedValue(
    {} as Awaited<ReturnType<typeof computeCenterStation>>,
  );
});

it("旧駅名を新しい駅名へ読み替え、読み替えたことを返す", async () => {
  const response = await POST(request(["日吉", "新宿"]));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.origins.map((origin: { name: string }) => origin.name)).toEqual(["日吉(神奈川)", "新宿"]);
  expect(body.renamedOrigins).toEqual([{ from: "日吉", to: "日吉(神奈川)" }]);
  const [options] = vi.mocked(computeCenterStation).mock.calls[0] ?? [];
  expect(options?.originStations.map((origin) => origin.name)).toEqual(["日吉(神奈川)", "新宿"]);
});

it("読み替えが無ければ renamedOrigins を返さない", async () => {
  const response = await POST(request(["日吉(神奈川)", "新宿"]));
  const body = await response.json();
  expect(body.renamedOrigins).toBeUndefined();
});

it("同じ旧駅名が複数あっても知らせは1回にする", async () => {
  const response = await POST(request(["日吉", "日吉", "新宿"]));
  const body = await response.json();
  expect(body.renamedOrigins).toEqual([{ from: "日吉", to: "日吉(神奈川)" }]);
});

it("読み替え表にも無い駅名は 400 を返す", async () => {
  const response = await POST(request(["存在しない駅", "新宿"]));
  expect(response.status).toBe(400);
  expect((await response.json()).unknown).toEqual(["存在しない駅"]);
});
