import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { auth, isAuthConfigured } from "@/auth";
import { createWorkspaceRepository } from "@/server/workspaceRepository";
import { loadStationIndex } from "@/server/stationRepository";
import { GET, POST } from "../app/api/workspaces/[token]/route";
import {
  PUT as putHistory,
  GET as getHistory,
  DELETE as deleteHistory,
} from "../app/api/member-history/route";
vi.mock("@/auth", () => ({ auth: vi.fn(), isAuthConfigured: vi.fn() }));
vi.mock("@/server/stationRepository", () => ({ loadStationIndex: vi.fn() }));
const state = vi.hoisted(() => ({
  repo: undefined as ReturnType<typeof createWorkspaceRepository> | undefined,
}));
vi.mock("@/server/workspaceRepository", async (original) => ({
  ...(await original<typeof import("@/server/workspaceRepository")>()),
  workspaceRepository: () => state.repo!,
}));
let token: string;
const conditions = {
  origins: [
    { name: "新宿", people: 1 },
    { name: "横浜", people: 2 },
  ],
  mode: "A" as const,
  fairnessWeight: 0.6,
  fareWeight: 0,
};
function user(id: string | null) {
  vi.mocked(auth).mockResolvedValue(
    (id ? { user: { id }, expires: "2099-01-01" } : null) as never,
  );
}
function req(method: string, data?: unknown, origin = "http://localhost:3001") {
  return new Request("http://localhost:3001/api/workspaces/token", {
    method,
    headers: { Origin: origin },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
function context() {
  return { params: Promise.resolve({ token }) };
}
beforeEach(() => {
  state.repo = createWorkspaceRepository(":memory:");
  token = state.repo.create("alice", "友達", "group", conditions).token;
  vi.stubEnv("AUTH_URL", "http://localhost:3001");
  vi.mocked(isAuthConfigured).mockReturnValue(true);
  user("alice");
  vi.mocked(loadStationIndex).mockResolvedValue(
    new Map([
      ["新宿", {}],
      ["横浜", {}],
    ]) as never,
  );
});
afterEach(() => {
  state.repo!.close();
  vi.unstubAllEnvs();
});
it("rejects unauthenticated requests, cross-origin writes and malformed actions", async () => {
  user(null);
  expect((await GET(req("GET"), context())).status).toBe(401);
  user("alice");
  expect(
    (
      await POST(
        req("POST", { type: "rotate" }, "https://evil.example"),
        context(),
      )
    ).status,
  ).toBe(403);
  for (const input of [
    { type: "profile", name: "Alice", station: "架空駅", people: 1 },
    { type: "profile", name: "Alice", station: "新宿", people: 11 },
    {
      type: "event",
      event: { title: "test", date: "bad", candidates: ["新宿"] },
    },
    {
      type: "event",
      event: {
        id: "",
        title: "test",
        date: "",
        station: "",
        place: "",
        placeUrl: "javascript:alert(1)",
        note: "",
        candidates: ["新宿"],
      },
    },
    { type: "vote", eventId: "x", station: "新宿", vote: "invalid" },
  ])
    expect((await POST(req("POST", input), context())).status).toBe(400);
  expect(
    (
      await POST(
        req("POST", { type: "join", name: "x".repeat(33000) }),
        context(),
      )
    ).status,
  ).toBe(413);
});
it("joins, updates a validated station and restricts organizer actions", async () => {
  user("bob");
  expect(await (await GET(req("GET"), context())).json()).toEqual({
    invitation: { name: "友達" },
  });
  expect(
    (await POST(req("POST", { type: "join", name: "Bob" }), context())).status,
  ).toBe(200);
  expect(
    (
      await POST(
        req("POST", {
          type: "profile",
          name: "Bob",
          station: "横浜",
          people: 2,
        }),
        context(),
      )
    ).status,
  ).toBe(200);
  expect((await POST(req("POST", { type: "rotate" }), context())).status).toBe(
    403,
  );
});
it("syncs history with validation and owner-scoped deletion", async () => {
  const entry = {
    ...conditions,
    id: "history1",
    bestName: "新宿",
    isFavorite: true,
  };
  expect((await putHistory(req("PUT", entry))).status).toBe(200);
  expect(
    (await (await getHistory(req("GET"))).json()).entries[0],
  ).toMatchObject(entry);
  user("bob");
  expect((await (await getHistory(req("GET"))).json()).entries).toEqual([]);
  await deleteHistory(req("DELETE", { id: "history1" }));
  user("alice");
  expect((await (await getHistory(req("GET"))).json()).entries).toHaveLength(1);
  expect(
    (await putHistory(req("PUT", { ...entry, bestName: "架空駅" }))).status,
  ).toBe(400);
  await deleteHistory(req("DELETE", { id: "history1" }));
  expect((await (await getHistory(req("GET"))).json()).entries).toEqual([]);
});

it("rejects queued writes after switching accounts", async () => {
  const request = req("PUT", { ...conditions, id: "old", bestName: "新宿" });
  request.headers.set("X-EkiHub-Account", "alice");
  user("bob");
  expect((await putHistory(request)).status).toBe(409);
  expect(state.repo!.history("bob")).toEqual([]);
});

it("creates a complete gathering and accepts another member's vote and attendance", async () => {
  const created = await POST(
    req("POST", {
      type: "event",
      event: {
        id: "",
        title: "集合",
        date: "2026-12-10T19:00+09:00",
        station: "新宿",
        place: "駅前",
        placeUrl: "https://example.com",
        note: "東口",
        candidates: ["新宿", "横浜"],
      },
    }),
    context(),
  );
  expect(created.status).toBe(200);
  const eventId = (await created.json()).workspace.gatherings[0].id;
  user("bob");
  await POST(req("POST", { type: "join", name: "Bob" }), context());
  expect(
    (
      await POST(
        req("POST", { type: "vote", eventId, station: "新宿", vote: "yes" }),
        context(),
      )
    ).status,
  ).toBe(200);
  const responded = await POST(
    req("POST", { type: "attendance", eventId, attendance: "yes" }),
    context(),
  );
  const { workspace } = await responded.json();
  expect(workspace.gatherings[0].attendance[workspace.selfId]).toBe("yes");
  expect(workspace.gatherings[0].votes[workspace.selfId].新宿).toBe("yes");
});
