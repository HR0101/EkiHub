import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/groups/route";
import { PATCH, DELETE } from "../app/api/groups/[id]/route";
import { auth, isAuthConfigured } from "@/auth";
import { createMemberRepository } from "@/server/memberRepository";
import { loadStationIndex } from "@/server/stationRepository";

vi.mock("@/server/workspaceRepository", () => ({
  workspaceRepository: () => ({ history: () => [] }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(), isAuthConfigured: vi.fn() }));
vi.mock("@/server/stationRepository", () => ({ loadStationIndex: vi.fn() }));
const state = vi.hoisted(() => ({
  repository: undefined as
    | ReturnType<
        typeof import("@/server/memberRepository").createMemberRepository
      >
    | undefined,
}));
vi.mock("@/server/memberRepository", async (original) => ({
  ...(await original<typeof import("@/server/memberRepository")>()),
  memberRepository: () => state.repository!,
}));
const input = {
  name: "友達",
  origins: [
    { name: "新宿", people: 2 },
    { name: "横浜", people: 3 },
  ],
  mode: "B",
  fairnessWeight: 0.8,
  fareWeight: 0.4,
};
function request(
  method: string,
  body = input,
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/groups", {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
}
function user(id: string | null) {
  vi.mocked(auth).mockResolvedValue(
    (id
      ? { user: { id, name: "member" }, expires: "2099-01-01" }
      : null) as never,
  );
}
beforeEach(() => {
  state.repository?.close();
  state.repository = createMemberRepository(":memory:");
  vi.stubEnv("AUTH_URL", "http://localhost:3000");
  vi.mocked(isAuthConfigured).mockReturnValue(true);
  user("alice");
  vi.mocked(loadStationIndex).mockResolvedValue(
    new Map([
      ["新宿", {}],
      ["横浜", {}],
    ]) as Awaited<ReturnType<typeof loadStationIndex>>,
  );
});
it("requires authentication and same-origin writes", async () => {
  user(null);
  expect((await GET(request("GET"))).status).toBe(401);
  expect((await POST(request("POST"))).status).toBe(401);
  user("alice");
  expect(
    (await POST(request("POST", input, "https://evil.example"))).status,
  ).toBe(403);
  const missingOrigin = request("POST");
  missingOrigin.headers.delete("origin");
  expect((await POST(missingOrigin)).status).toBe(403);
  expect(state.repository!.list("alice")).toEqual([]);
});
it("saves, restores, updates and deletes while rejecting another user's access", async () => {
  const created = await POST(request("POST"));
  expect(created.status).toBe(201);
  const { group } = await created.json();
  const context = { params: Promise.resolve({ id: group.id }) };
  expect((await (await GET(request("GET"))).json()).groups[0]).toMatchObject(
    input,
  );
  user("bob");
  expect((await (await GET(request("GET"))).json()).groups).toEqual([]);
  expect((await PATCH(request("PATCH"), context)).status).toBe(404);
  expect((await DELETE(request("DELETE"), context)).status).toBe(404);
  user("alice");
  expect(
    (await PATCH(request("PATCH", { ...input, name: "更新後" }), context))
      .status,
  ).toBe(200);
  expect((await DELETE(request("DELETE"), context)).status).toBe(204);
});
it("rejects unknown stations instead of persisting invalid groups", async () => {
  const value = {
    ...input,
    origins: [{ name: "未登録駅", people: 1 }, input.origins[1]!],
  };
  expect((await POST(request("POST", value))).status).toBe(400);
  expect(state.repository!.list("alice")).toEqual([]);
});
it("returns a service-unavailable response when OAuth is not configured", async () => {
  vi.mocked(isAuthConfigured).mockReturnValue(false);
  expect((await GET(request("GET"))).status).toBe(503);
});

it("disables unconfigured login without attempting to read a session", async () => {
  vi.mocked(isAuthConfigured).mockReturnValue(false);
  vi.mocked(auth).mockClear();
  const { GET: getAccount } = await import("../app/api/account/route");
  const response = await getAccount();
  expect(await response.json()).toEqual({ enabled: false, user: null });
  expect(vi.mocked(auth)).not.toHaveBeenCalled();
});

it("exports only the authenticated owner's groups as an uncached attachment", async () => {
  state.repository!.create("alice", input as never);
  state.repository!.create("bob", { ...input, name: "private" } as never);
  const { GET: exportGroups } = await import("../app/api/account/export/route");
  const response = await exportGroups(request("GET"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  const data = await response.json();
  expect(data.version).toBe(1);
  expect(data.groups).toHaveLength(1);
  expect(data.groups[0].name).toBe("友達");
  user(null);
  expect((await exportGroups(request("GET"))).status).toBe(401);
});
