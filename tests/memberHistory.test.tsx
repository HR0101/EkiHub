// @vitest-environment jsdom
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useSearchHistory, type HistoryEntry } from "@/hooks/useSearchHistory";
const auth = vi.hoisted(() => ({ user: null as string | null }));
vi.mock("@/hooks/useMemberGroups", () => ({
  useMemberAccount: () => ({
    data: { user: auth.user ? { id: auth.user } : null },
  }),
}));
let client: QueryClient;
let history: Record<string, HistoryEntry[]>;
let writes: number;
const input = {
  origins: [
    { name: "新宿", people: 2 },
    { name: "横浜", people: 1 },
  ],
  mode: "A" as const,
  bestName: "新宿",
  fairnessWeight: 0.8,
  fareWeight: 0.5,
};
beforeEach(() => {
  auth.user = null;
  localStorage.clear();
  writes = 0;
  history = { alice: [], bob: [] };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const user = auth.user!;
      if (init?.method === "PUT") {
        writes++;
        const entry = {
          ...JSON.parse(init.body as string),
          savedAt: new Date().toISOString(),
        };
        history[user] = [
          entry,
          ...history[user]!.filter((e) => e.id !== entry.id),
        ];
        return Response.json({ entry });
      }
      if (init?.method === "DELETE") {
        const { id } = JSON.parse(init.body as string);
        history[user] = history[user]!.filter((e) => e.id !== id);
        return new Response(null, { status: 204 });
      }
      return Response.json({ entries: history[user] ?? [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
it("keeps guest history local and imports it only on explicit request after login", async () => {
  const { result, rerender } = renderHook(() => useSearchHistory(), {
    wrapper,
  });
  act(() => result.current.record(input));
  expect(result.current.entries).toHaveLength(1);
  expect(writes).toBe(0);
  auth.user = "alice";
  rerender();
  await waitFor(() => expect(result.current.synced).toBe(true));
  expect(result.current.entries).toEqual([]);
  expect(writes).toBe(0);
  act(() => result.current.importLocal());
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  expect(result.current.entries[0]).toMatchObject(input);
  expect(writes).toBe(1);
});
it("syncs favorites, deletes and separates account caches", async () => {
  auth.user = "alice";
  const { result, rerender } = renderHook(() => useSearchHistory(), {
    wrapper,
  });
  act(() => result.current.record(input));
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  const id = result.current.entries[0]!.id;
  act(() => result.current.toggleFavorite(id));
  await waitFor(() => expect(result.current.entries[0]!.isFavorite).toBe(true));
  act(() => result.current.record(input));
  await waitFor(() => expect(writes).toBe(3));
  await waitFor(() => expect(result.current.entries[0]!.isFavorite).toBe(true));
  auth.user = "bob";
  rerender();
  await waitFor(() => expect(result.current.entries).toEqual([]));
  auth.user = "alice";
  rerender();
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  act(() => result.current.remove(id));
  await waitFor(() => expect(result.current.entries).toEqual([]));
});
