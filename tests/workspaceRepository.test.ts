import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createWorkspaceRepository } from "@/server/workspaceRepository";
vi.mock("@/auth", () => ({ auth: vi.fn(), isAuthConfigured: vi.fn() }));
let repo: ReturnType<typeof createWorkspaceRepository>;
beforeEach(() => {
  repo = createWorkspaceRepository(":memory:");
});
afterEach(() => repo.close());
const conditions = {
  origins: [
    { name: "新宿", people: 1 },
    { name: "横浜", people: 2 },
  ],
  mode: "A" as const,
  fairnessWeight: 0.6,
  fareWeight: 0,
};
function create() {
  return repo.create("alice", "大学の友達", "group-a", conditions);
}
it("requires explicit membership and isolates lists, profiles and owner actions", () => {
  const room = create();
  expect(repo.read(room.token, "bob")).toEqual({
    invitation: { name: "大学の友達" },
  });
  expect(repo.list("bob")).toEqual([]);
  expect(() =>
    repo.mutate(room.token, "bob", {
      type: "profile",
      name: "x",
      station: "新宿",
      people: 1,
    }),
  ).toThrow();
  repo.mutate(room.token, "bob", { type: "join", name: "Bob" });
  const b = repo.mutate(room.token, "bob", {
    type: "profile",
    name: "Bob",
    station: "横浜",
    people: 3,
  }).workspace!;
  expect(b.members.find((m) => m.id === b.selfId)).toMatchObject({
    station: "横浜",
    people: 3,
  });
  expect(JSON.stringify(b)).not.toContain("userId");
  expect(b.owner).toBe(false);
  expect(repo.list("bob")).toHaveLength(1);
  expect(() =>
    repo.mutate(room.token, "bob", {
      type: "preferences",
      preferences: { priority: "budget", spot: "bar", note: "" },
    }),
  ).toThrow();
  expect(() => repo.mutate(room.token, "bob", { type: "close" })).toThrow();
  expect(() => repo.create("bob", "x", "group-a", conditions)).toThrow();
});
it("persists preferences, events, independent votes and attendance, cleaning removed choices", () => {
  const room = create();
  repo.mutate(room.token, "bob", { type: "join", name: "Bob" });
  repo.mutate(room.token, "alice", {
    type: "preferences",
    preferences: { priority: "budget", spot: "bar", note: "安く集まる" },
  });
  const created = repo.mutate(room.token, "alice", {
    type: "event",
    event: {
      id: "",
      title: "忘年会",
      date: "2026-12-10T19:00+09:00",
      station: "新宿",
      place: "お店",
      placeUrl: "https://example.com",
      note: "改札前",
      candidates: ["新宿", "横浜"],
    },
  }).workspace!;
  const event = created.gatherings[0]!;
  repo.mutate(room.token, "alice", {
    type: "vote",
    eventId: event.id,
    station: "新宿",
    vote: "yes",
  });
  repo.mutate(room.token, "bob", {
    type: "vote",
    eventId: event.id,
    station: "新宿",
    vote: "no",
  });
  repo.mutate(room.token, "bob", {
    type: "attendance",
    eventId: event.id,
    attendance: "maybe",
  });
  const b = repo.read(room.token, "bob").workspace!;
  expect(b.gatherings[0]!.votes[b.selfId]?.新宿).toBe("no");
  expect(b.gatherings[0]!.attendance[b.selfId]).toBe("maybe");
  expect(b.preferences.spot).toBe("bar");
  expect(() =>
    repo.mutate(room.token, "bob", { type: "deleteEvent", eventId: event.id }),
  ).toThrow();
  expect(() =>
    repo.mutate(room.token, "bob", {
      type: "vote",
      eventId: event.id,
      station: "大宮",
      vote: "yes",
    }),
  ).toThrow();
  const edited = repo.mutate(room.token, "alice", {
    type: "event",
    event: { ...event, title: "更新", candidates: ["横浜"] },
  }).workspace!;
  expect(Object.values(edited.gatherings[0]!.votes).every((v) => !v.新宿)).toBe(
    true,
  );
  expect(edited.gatherings[0]!.attendance[b.selfId]).toBe("maybe");
  repo.mutate(room.token, "alice", { type: "deleteEvent", eventId: event.id });
  expect(repo.read(room.token, "alice").workspace!.gatherings).toEqual([]);
});
it("revokes old links, removes departing member data and closes shared rooms", () => {
  const room = create();
  const b = repo.mutate(room.token, "bob", {
    type: "join",
    name: "Bob",
  }).workspace!;
  const rotated = repo.mutate(room.token, "alice", {
    type: "rotate",
  }).workspace!;
  expect(rotated.token).not.toBe(room.token);
  expect(() => repo.read(room.token, "bob")).toThrow();
  expect(repo.list("bob")[0]!.token).toBe(rotated.token);
  expect(repo.mutate(rotated.token, "bob", { type: "leave" })).toEqual({
    left: true,
  });
  expect(
    repo
      .read(rotated.token, "alice")
      .workspace!.members.some((m) => m.id === b.selfId),
  ).toBe(false);
  expect(repo.list("bob")).toEqual([]);
  expect(() =>
    repo.mutate(rotated.token, "alice", { type: "leave" }),
  ).toThrow();
  repo.mutate(rotated.token, "alice", { type: "close" });
  expect(repo.list("alice")).toEqual([]);
  expect(() => repo.read(rotated.token, "alice")).toThrow();
});
it("limits membership and keeps history updates and deletion scoped to each account", () => {
  const room = create();
  for (let i = 0; i < 19; i++)
    repo.mutate(room.token, `user${i}`, { type: "join", name: `User${i}` });
  expect(() =>
    repo.mutate(room.token, "extra", { type: "join", name: "Extra" }),
  ).toThrow();
  for (let i = 0; i < 25; i++)
    repo.putHistory("alice", {
      id: `id-${i}`,
      savedAt: new Date(100000 + i).toISOString(),
    });
  expect(repo.history("alice")).toHaveLength(20);
  expect(repo.history("bob")).toEqual([]);
  repo.putHistory("alice", { id: "favorite", savedAt: "2026-10-21" });
  repo.deleteHistory("bob", "favorite");
  expect(repo.history("alice")[0].id).toBe("favorite");
  repo.deleteHistory("alice", "favorite");
  expect(repo.history("alice").some((e) => e.id === "favorite")).toBe(false);
});
