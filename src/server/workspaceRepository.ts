import Database from "better-sqlite3";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultPreferences,
  type Workspace,
  type WorkspaceMember,
  type Gathering,
  type GroupPreferences,
} from "@/lib/memberWorkspace";
import type { GroupConditions } from "@/lib/memberGroups";
import { MemberApiError } from "@/server/memberApi";

type Stored = Omit<Workspace, "owner" | "selfId" | "members"> & {
  ownerId: string;
  members: (WorkspaceMember & { userId: string })[];
};
export function createWorkspaceRepository(path: string) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS member_history (owner TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(owner,id)); CREATE TABLE IF NOT EXISTS workspace_members (workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id)); CREATE INDEX IF NOT EXISTS workspace_members_user ON workspace_members(user_id);",
  );
  // Backfill membership indices for databases created before the index was introduced.
  db.exec(`INSERT OR IGNORE INTO workspace_members(workspace_id,user_id)
    SELECT w.id, json_extract(m.value, '$.userId') FROM workspaces w, json_each(w.data, '$.members') m;`);
  const get = (token: string): Stored => {
    const row = db
      .prepare("SELECT data FROM workspaces WHERE token=?")
      .get(token) as { data: string } | undefined;
    if (!row)
      throw new MemberApiError(
        "招待リンクが無効です。幹事に最新のリンクを確認してください。",
        404,
      );
    return JSON.parse(row.data);
  };
  const save = (room: Stored) => {
    db.prepare(
      "INSERT INTO workspaces(id,token,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,data=excluded.data",
    ).run(room.id, room.token, JSON.stringify(room));
    db.prepare("DELETE FROM workspace_members WHERE workspace_id=?").run(
      room.id,
    );
    const insert = db.prepare(
      "INSERT INTO workspace_members(workspace_id,user_id) VALUES(?,?)",
    );
    for (const m of room.members) insert.run(room.id, m.userId);
  };
  const member = (room: Stored, user: string) => {
    const me = room.members.find((m) => m.userId === user);
    if (!me) throw new MemberApiError("このグループに参加してください。", 403);
    return me;
  };
  const view = (room: Stored, user: string): Workspace => {
    const me = member(room, user);
    const { ownerId, members, ...rest } = room;
    return {
      ...rest,
      owner: ownerId === user,
      selfId: me.id,
      members: members.map(({ userId: _private, ...m }) => m),
    };
  };
  return {
    create: db.transaction(
      (
        user: string,
        name: string,
        groupId: string,
        conditions: GroupConditions,
      ) => {
        // One workspace per saved group, only its authenticated owner may call this method.
        const existing = db
          .prepare("SELECT data FROM workspaces WHERE id=?")
          .get(groupId) as { data: string } | undefined;
        if (existing) {
          const room: Stored = JSON.parse(existing.data);
          if (room.ownerId !== user)
            throw new MemberApiError("操作できません。", 403);
          return view(room, user);
        }
        const count = db
          .prepare(
            "SELECT COUNT(*) AS n FROM workspace_members WHERE user_id=?",
          )
          .get(user) as { n: number };
        if (count.n >= 30)
          throw new MemberApiError("共有グループは30件までです。", 409);
        const room: Stored = {
          id: groupId,
          name,
          token: randomBytes(32).toString("base64url"),
          ownerId: user,
          conditions,
          preferences: { ...defaultPreferences },
          members: [
            {
              id: randomUUID(),
              userId: user,
              name: "幹事",
              station: "",
              people: 1,
            },
          ],
          gatherings: [],
        };
        save(room);
        return view(room, user);
      },
    ),
    list(user: string) {
      const rows = db
        .prepare(
          "SELECT w.data FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=?",
        )
        .all(user) as {
        data: string;
      }[];
      return rows
        .map((r) => JSON.parse(r.data) as Stored)
        .filter((r) => r.members.some((m) => m.userId === user))
        .map((r) => ({
          id: r.id,
          name: r.name,
          token: r.token,
          owner: r.ownerId === user,
        }));
    },
    read(token: string, user: string) {
      const room = get(token);
      return room.members.some((m) => m.userId === user)
        ? { workspace: view(room, user) }
        : { invitation: { name: room.name } };
    },
    mutate: db.transaction(
      (token: string, user: string, action: Record<string, unknown>) => {
        const room = get(token);
        if (action.type === "join") {
          if (!room.members.some((m) => m.userId === user)) {
            if (room.members.length >= 20)
              throw new MemberApiError("参加者は20人までです。", 409);
            const count = db
              .prepare(
                "SELECT COUNT(*) AS n FROM workspace_members WHERE user_id=?",
              )
              .get(user) as { n: number };
            if (count.n >= 30)
              throw new MemberApiError(
                "参加できる共有グループは30件までです。",
                409,
              );
            room.members.push({
              id: randomUUID(),
              userId: user,
              name: action.name as string,
              station: "",
              people: 1,
            });
          }
        } else {
          const me = member(room, user);
          const owner = () => {
            if (room.ownerId !== user)
              throw new MemberApiError("幹事だけが変更できます。", 403);
          };
          if (action.type === "profile")
            Object.assign(me, {
              name: action.name,
              station: action.station,
              people: action.people,
            });
          else if (action.type === "preferences") {
            owner();
            room.preferences = action.preferences as GroupPreferences;
          } else if (action.type === "rotate") {
            owner();
            room.token = randomBytes(32).toString("base64url");
          } else if (action.type === "leave") {
            if (room.ownerId === user)
              throw new MemberApiError(
                "幹事は退会できません。共有グループを終了してください。",
                400,
              );
            room.members = room.members.filter((m) => m.userId !== user);
            room.gatherings.forEach((e) => {
              delete e.votes[me.id];
              delete e.attendance[me.id];
            });
            save(room);
            return { left: true };
          } else if (action.type === "close") {
            owner();
            db.prepare("DELETE FROM workspaces WHERE id=?").run(room.id);
            db.prepare(
              "DELETE FROM workspace_members WHERE workspace_id=?",
            ).run(room.id);
            return { closed: true };
          } else if (action.type === "event") {
            owner();
            const event = action.event as Gathering;
            const index = room.gatherings.findIndex((e) => e.id === event.id);
            if (event.id && index < 0)
              throw new MemberApiError("予定が見つかりません。", 404);
            if (index < 0) {
              if (room.gatherings.length >= 20)
                throw new MemberApiError("予定は20件までです。", 409);
              room.gatherings.push({
                ...event,
                id: randomUUID(),
                votes: {},
                attendance: {},
              });
            } else {
              const previous = room.gatherings[index]!;
              // Retain only votes for candidates still present.
              room.gatherings[index] = {
                ...event,
                votes: Object.fromEntries(
                  Object.entries(previous.votes).map(([id, votes]) => [
                    id,
                    Object.fromEntries(
                      Object.entries(votes).filter(([station]) =>
                        event.candidates.includes(station),
                      ),
                    ),
                  ]),
                ),
                attendance: previous.attendance,
              };
            }
          } else {
            const event = room.gatherings.find((e) => e.id === action.eventId);
            if (!event) throw new MemberApiError("予定が見つかりません。", 404);
            if (action.type === "deleteEvent") {
              owner();
              room.gatherings = room.gatherings.filter((e) => e !== event);
            } else if (action.type === "vote") {
              if (!event.candidates.includes(action.station as string))
                throw new MemberApiError("候補駅を選択してください。", 400);
              event.votes[me.id] ??= {};
              if (action.vote === null)
                delete event.votes[me.id]![action.station as string];
              else
                event.votes[me.id]![action.station as string] = action.vote as
                  "yes" | "no";
            } else if (action.type === "attendance")
              event.attendance[me.id] = action.attendance as
                "yes" | "no" | "maybe";
            else throw new MemberApiError("操作を確認してください。", 400);
          }
        }
        save(room);
        return { workspace: view(room, user) };
      },
    ),
    history(user: string) {
      return (
        db
          .prepare(
            "SELECT data FROM member_history WHERE owner=? ORDER BY updated DESC,id LIMIT 20",
          )
          .all(user) as { data: string }[]
      ).map((r) => JSON.parse(r.data));
    },
    putHistory: db.transaction(
      (user: string, entry: { id: string; savedAt: string }) => {
        db.prepare(
          "INSERT INTO member_history(owner,id,data,updated) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data,updated=excluded.updated",
        ).run(user, entry.id, JSON.stringify(entry), entry.savedAt);
        db.prepare(
          "DELETE FROM member_history WHERE owner=? AND id NOT IN (SELECT id FROM member_history WHERE owner=? ORDER BY updated DESC,id LIMIT 20)",
        ).run(user, user);
      },
    ),
    deleteHistory(user: string, id: string) {
      db.prepare("DELETE FROM member_history WHERE owner=? AND id=?").run(
        user,
        id,
      );
    },
    close() {
      db.close();
    },
  };
}
let repository: ReturnType<typeof createWorkspaceRepository> | undefined;
export function workspaceRepository() {
  return (repository ??= createWorkspaceRepository(
    // Runtime data must never be traced into the deployment bundle.
    resolve(
      /* turbopackIgnore: true */ process.env.MEMBER_DATABASE_PATH ||
        "var/members.sqlite",
    ),
  ));
}
