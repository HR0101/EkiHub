// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { signIn } from "next-auth/react";
import { MemberAccountPage } from "@/components/MemberAccountPage";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { useEkiHubStore } from "@/stores/useEkiHubStore";
import type { MemberGroup } from "@/lib/memberGroups";
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/components/PageChrome", () => ({
  Toolbar: () => null,
  Footer: () => null,
}));
vi.mock("@/hooks/useSearchDraft", () => ({ useSearchDraft: vi.fn() }));
vi.mock("@/hooks/useStations", () => ({
  useStations: () => ({
    data: [
      { name: "新宿", kana: "しんじゅく" },
      { name: "横浜", kana: "よこはま" },
    ],
    isError: false,
  }),
}));
let loggedIn = true;
let enabled = true;
let groups: MemberGroup[] = [];
let lastSaved: Partial<MemberGroup> | undefined;
let client: QueryClient;
beforeEach(() => {
  loggedIn = true;
  enabled = true;
  groups = [];
  lastSaved = undefined;
  localStorage.clear();
  sessionStorage.clear();
  useEkiHubStore.getState().setRows([
    { name: "新宿", people: 2 },
    { name: "横浜", people: 3 },
  ]);
  useEkiHubStore.setState({ mode: "B", fairnessWeight: 0.8, fareWeight: 0.4 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/workspaces") return Response.json({ workspaces: [] });
      if (url === "/api/account")
        return Response.json({
          enabled,
          user: loggedIn ? { id: "alice", name: "Alice" } : null,
        });
      if (url === "/api/groups" && (!init?.method || init.method === "GET"))
        return Response.json({ groups });
      if (init?.method === "POST" || init?.method === "PATCH") {
        const value = JSON.parse(init.body as string);
        lastSaved = value;
        const group = { ...value, id: "saved-1", updatedAt: "2026-10-21" };
        groups = [group];
        return Response.json({ group });
      }
      if (init?.method === "DELETE") {
        groups = [];
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected URL ${url}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function mount() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <MemberAccountPage />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}
it("saves, edits and deletes groups, preserving stations, people and all preferences", async () => {
  mount();
  const name = await screen.findByLabelText("グループ名");
  fireEvent.change(name, { target: { value: "大学の友達" } });
  fireEvent.click(screen.getByRole("button", { name: "グループを保存" }));
  const search = await screen.findByRole("link", {
    name: "このグループで検索",
  });
  const params = new URLSearchParams(
    search.getAttribute("href")!.split("?")[1],
  );
  expect(params.get("people")).toBe("2,3");
  expect(params.get("mode")).toBe("B");
  expect(params.get("w")).toBe("80");
  expect(params.get("fw")).toBe("40");
  expect(lastSaved).toMatchObject({
    origins: [
      { name: "新宿", people: 2 },
      { name: "横浜", people: 3 },
    ],
    mode: "B",
    fairnessWeight: 0.8,
    fareWeight: 0.4,
  });
  fireEvent.click(screen.getByRole("button", { name: "編集" }));
  fireEvent.change(name, { target: { value: "更新した友達" } });
  fireEvent.change(screen.getByRole("combobox", { name: "最寄駅 1 — 人数" }), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));
  await screen.findByRole("heading", { name: "更新した友達" });
  expect(lastSaved?.origins?.[0]?.people).toBe(7);
  fireEvent.click(screen.getByRole("button", { name: "削除" }));
  const confirmation = screen.getByRole("group", {
    name: "このグループを削除しますか？",
  });
  fireEvent.click(within(confirmation).getByRole("button", { name: "削除" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("link", { name: "このグループで検索" }),
    ).toBeNull(),
  );
});
it("starts Google sign-in only after an explicit click", async () => {
  loggedIn = false;
  mount();
  const button = await screen.findByRole("button", {
    name: "Googleでログイン",
  });
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/account" });
});
it("keeps the guest search reachable when OAuth is unconfigured", async () => {
  loggedIn = false;
  enabled = false;
  mount();
  await screen.findByText(
    "Googleログインは現在準備中です。駅の検索はログインなしで使えます。",
  );
  expect(screen.queryByRole("button", { name: "Googleでログイン" })).toBeNull();
  expect(
    screen.getByRole("link", { name: /駅の検索に戻る/ }).getAttribute("href"),
  ).toBe("/");
});
