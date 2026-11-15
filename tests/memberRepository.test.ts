import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createMemberRepository,
  GroupLimitError,
} from "@/server/memberRepository";
import { parseGroupInput } from "@/lib/memberGroups";
const input = parseGroupInput({
  name: "友達",
  origins: [
    { name: "新宿", people: 2 },
    { name: "横浜", people: 3 },
  ],
  mode: "B",
  fairnessWeight: 0.8,
  fareWeight: 0.4,
});
const repositories: ReturnType<typeof createMemberRepository>[] = [];
afterEach(() => {
  repositories.splice(0).forEach((r) => r.close());
});
function repository() {
  const repo = createMemberRepository(":memory:");
  repositories.push(repo);
  return repo;
}
it("isolates listing, updates and deletions by authenticated owner", () => {
  const repo = repository();
  const group = repo.create("google:alice", input);
  expect(repo.list("google:alice")[0]).toEqual(group);
  expect(repo.list("google:bob")).toEqual([]);
  expect(
    repo.update("google:bob", group.id, { ...input, name: "改ざん" }),
  ).toBeNull();
  expect(repo.remove("google:bob", group.id)).toBe(false);
  expect(repo.list("google:alice")[0]).toEqual(group);
  expect(
    repo.update("google:alice", group.id, {
      ...input,
      name: "大学の友達",
      fareWeight: 0.7,
    })?.fareWeight,
  ).toBe(0.7);
  expect(repo.remove("google:alice", group.id)).toBe(true);
  expect(repo.list("google:alice")).toEqual([]);
});
it("persists all search settings across database connections", () => {
  const directory = mkdtempSync(join(tmpdir(), "ekihub-members-"));
  try {
    const file = join(directory, "members.sqlite");
    const first = createMemberRepository(file);
    const saved = first.create("google:alice", input);
    first.close();
    const second = createMemberRepository(file);
    try {
      expect(second.list("google:alice")).toEqual([saved]);
    } finally {
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
it("enforces the group limit atomically per owner", () => {
  const repo = repository();
  for (let i = 0; i < 30; i++) repo.create("google:alice", input);
  expect(() => repo.create("google:alice", input)).toThrow(GroupLimitError);
  expect(repo.list("google:alice")).toHaveLength(30);
  expect(repo.create("google:bob", input).name).toBe(input.name);
});
it.each([
  { ...input, name: " " },
  { ...input, origins: [input.origins[0]] },
  { ...input, origins: [{ name: "新宿", people: 11 }, input.origins[1]] },
  { ...input, fairnessWeight: NaN },
  { ...input, mode: "C" },
])("rejects malformed saved search input", (value) => {
  expect(() => parseGroupInput(value)).toThrow();
});
