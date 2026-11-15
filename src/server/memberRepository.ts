import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { GroupConditions, MemberGroup } from "@/lib/memberGroups";

export class GroupLimitError extends Error {}

type GroupInput = GroupConditions & { name: string };
type GroupRow = {
  id: string;
  name: string;
  conditions: string;
  updated_at: string;
};

/** Owner predicates are mandatory for every read and mutation. */
export function createMemberRepository(filePath: string) {
  if (filePath !== ":memory:")
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
  const db = new Database(filePath);
  if (filePath !== ":memory:") chmodSync(filePath, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS member_groups (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
    conditions TEXT NOT NULL, updated_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS member_groups_owner ON member_groups(owner_id);`);
  const read = (row: GroupRow): MemberGroup => ({
    id: row.id,
    name: row.name,
    ...(JSON.parse(row.conditions) as GroupConditions),
    updatedAt: row.updated_at,
  });
  return {
    list(owner: string): MemberGroup[] {
      return (
        db
          .prepare(
            "SELECT id,name,conditions,updated_at FROM member_groups WHERE owner_id=? ORDER BY updated_at DESC,id",
          )
          .all(owner) as GroupRow[]
      ).map(read);
    },
    create: db.transaction((owner: string, input: GroupInput): MemberGroup => {
      const count = db
        .prepare("SELECT COUNT(*) AS n FROM member_groups WHERE owner_id=?")
        .get(owner) as { n: number };
      if (count.n >= 30)
        throw new GroupLimitError("保存できるグループは30件までです。");
      const { name, ...conditions } = input;
      const group = {
        ...conditions,
        name,
        id: randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      db.prepare(
        "INSERT INTO member_groups (id,owner_id,name,conditions,updated_at) VALUES (?,?,?,?,?)",
      ).run(group.id, owner, name, JSON.stringify(conditions), group.updatedAt);
      return group;
    }),
    update(owner: string, id: string, input: GroupInput): MemberGroup | null {
      const { name, ...conditions } = input;
      const updatedAt = new Date().toISOString();
      const result = db
        .prepare(
          "UPDATE member_groups SET name=?,conditions=?,updated_at=? WHERE id=? AND owner_id=?",
        )
        .run(name, JSON.stringify(conditions), updatedAt, id, owner);
      return result.changes ? { ...input, id, updatedAt } : null;
    },
    remove(owner: string, id: string): boolean {
      return (
        db
          .prepare("DELETE FROM member_groups WHERE id=? AND owner_id=?")
          .run(id, owner).changes > 0
      );
    },
    close() {
      db.close();
    },
  };
}
let repository: ReturnType<typeof createMemberRepository> | undefined;
export function memberRepository() {
  repository ??= createMemberRepository(
    // Runtime data must never be traced into the deployment bundle.
    resolve(
      /* turbopackIgnore: true */ process.env.MEMBER_DATABASE_PATH ||
        "var/members.sqlite",
    ),
  );
  return repository;
}
