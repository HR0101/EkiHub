// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/WorkspacePage";
import type { Workspace } from "@/lib/memberWorkspace";
const auth = vi.hoisted(() => ({ user: true }));
vi.mock("@/hooks/useMemberGroups", () => ({
  useMemberAccount: () => ({
    isPending: false,
    data: { enabled: true, user: auth.user ? { id: "alice" } : null },
  }),
}));
vi.mock("@/hooks/useStations", () => ({
  useStations: () => ({ data: [{ name: "新宿" }, { name: "横浜" }] }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
let room: Workspace;
let invitation: boolean;
let calls: Record<string, unknown>[];
let client: QueryClient;
beforeEach(() => {
  auth.user = true;
  invitation = false;
  calls = [];
  room = {
    id: "group",
    name: "友達",
    token: "token",
    owner: true,
    selfId: "self",
    conditions: {
      origins: [
        { name: "新宿", people: 1 },
        { name: "横浜", people: 1 },
      ],
      mode: "A",
      fairnessWeight: 0.6,
      fareWeight: 0,
    },
    preferences: { priority: "balanced", spot: "none", note: "" },
    members: [
      { id: "self", name: "Alice", station: "新宿", people: 1 },
      { id: "other", name: "Bob", station: "横浜", people: 2 },
    ],
    gatherings: [
      {
        id: "event",
        title: "忘年会",
        date: "2026-12-10T19:00+09:00",
        station: "新宿",
        place: "駅前のお店",
        placeUrl: "https://example.com",
        note: "集合は改札",
        candidates: ["新宿", "横浜"],
        votes: {},
        attendance: {},
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const data = JSON.parse(init.body as string);
        calls.push(data);
        if (data.type === "join") invitation = false;
        if (data.type === "profile")
          room.members[0] = {
            ...room.members[0]!,
            name: data.name,
            station: data.station,
            people: data.people,
          };
        if (data.type === "vote")
          room.gatherings[0]!.votes.self = { [data.station]: data.vote };
        if (data.type === "attendance")
          room.gatherings[0]!.attendance.self = data.attendance;
        return Response.json({ workspace: room });
      }
      return Response.json(
        invitation ? { invitation: { name: "友達" } } : { workspace: room },
      );
    }),
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});
function mount() {
  render(
    <QueryClientProvider client={client}>
      <WorkspacePage token="token" />
    </QueryClientProvider>,
  );
}
it("registers a personal station, votes and attendance and links to a search using all members", async () => {
  mount();
  await screen.findByRole("heading", { name: "自分の出発駅" });
  fireEvent.change(screen.getByLabelText("人数"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "出発駅を保存" }));
  await waitFor(() =>
    expect(calls[0]).toEqual({
      type: "profile",
      name: "Alice",
      station: "新宿",
      people: 4,
    }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("link", { name: "登録された出発駅から検索" })
        .getAttribute("href"),
    ).toContain("people=4%2C2"),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "ここがいい" })[0]!);
  await waitFor(() =>
    expect(
      calls.some(
        (c) => c.type === "vote" && c.station === "新宿" && c.vote === "yes",
      ),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("button", { name: "ここがいい" })[0]!
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
  fireEvent.click(screen.getByRole("button", { name: "参加" }));
  await waitFor(() =>
    expect(
      calls.some((c) => c.type === "attendance" && c.attendance === "yes"),
    ).toBe(true),
  );
});
it("shows explicit sharing consent before joining and hides all member details", async () => {
  invitation = true;
  mount();
  await screen.findByRole("heading", { name: "グループへの招待" });
  expect(screen.queryByText("Bob")).toBeNull();
  expect(screen.queryByRole("heading", { name: "忘年会" })).toBeNull();
  expect(calls).toEqual([]);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "New member" },
  });
  fireEvent.click(screen.getByRole("button", { name: "参加する" }));
  await screen.findByRole("heading", { name: "自分の出発駅" });
  expect(calls[0]).toEqual({ type: "join", name: "New member" });
});
it("lets ordinary members respond while disabling organizer controls", async () => {
  room.owner = false;
  mount();
  await screen.findByRole("heading", { name: "グループの好み" });
  expect(screen.queryByRole("button", { name: "予定を保存" })).toBeNull();
  expect(screen.queryByRole("button", { name: "招待リンクを更新" })).toBeNull();
  const preferences = screen
    .getByRole("heading", { name: "グループの好み" })
    .closest("section")!;
  expect(
    within(preferences)
      .getByRole("combobox", { name: "重視すること" })
      .closest("fieldset")!.disabled,
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "このグループから退会" }),
  ).toBeTruthy();
});
