/** Exercises the production bundle with short-lived, locally signed test sessions. */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";

const port = Number(process.env.MEMBER_SMOKE_PORT || 3002);
const origin = `http://127.0.0.1:${port}`;
const directory = mkdtempSync(join(tmpdir(), "ekihub-member-smoke-"));
const secret = randomBytes(32).toString("base64url");
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    AUTH_URL: origin,
    AUTH_SECRET: secret,
    AUTH_GOOGLE_ID: "local-smoke-client",
    AUTH_GOOGLE_SECRET: "local-smoke-secret",
    MEMBER_DATABASE_PATH: join(directory, "members.sqlite"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (data) => {
  logs += data;
});
child.stderr.on("data", (data) => {
  logs += data;
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error(`Server exited ${child.exitCode}: ${logs}`);
    try {
      ready = (await fetch(`${origin}/api/health`)).ok;
    } catch {
      /* Starting. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, `Server did not start: ${logs}`);
  async function cookie(user) {
    return (
      "authjs.session-token=" +
      (await encode({
        secret,
        salt: "authjs.session-token",
        token: { sub: `google:${user}`, name: user },
      }))
    );
  }
  const alice = await cookie("smoke-alice");
  const bob = await cookie("smoke-bob");
  async function request(path, userCookie = "", method = "GET", body) {
    return fetch(`${origin}${path}`, {
      method,
      headers: {
        cookie: userCookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  assert.equal((await request("/api/groups")).status, 401);
  assert.equal((await request("/account")).status, 200);
  const account = await (await request("/api/account", alice)).json();
  assert.equal(account.user.id, "google:smoke-alice");
  const input = {
    name: "Production smoke test",
    origins: [
      { name: "新宿", people: 2 },
      { name: "横浜", people: 3 },
    ],
    mode: "B",
    fairnessWeight: 0.8,
    fareWeight: 0.4,
  };
  const created = await request("/api/groups", alice, "POST", input);
  assert.equal(created.status, 201, await created.clone().text());
  const { group } = await created.json();
  assert.equal(
    (await (await request("/api/groups", alice)).json()).groups[0].fareWeight,
    0.4,
  );
  assert.deepEqual(
    (await (await request("/api/groups", bob)).json()).groups,
    [],
  );
  assert.equal(
    (await request(`/api/groups/${group.id}`, bob, "DELETE")).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/groups/${group.id}`, alice, "PATCH", {
        ...input,
        name: "Updated",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/groups`, {
        method: "POST",
        headers: {
          cookie: alice,
          Origin: "https://other.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      })
    ).status,
    403,
  );
  const shared = await request("/api/workspaces", alice, "POST", {
    groupId: group.id,
  });
  assert.equal(shared.status, 201, await shared.clone().text());
  const { workspace: room } = await shared.json();
  let roomPath = `/api/workspaces/${room.token}`;
  assert.deepEqual(await (await request(roomPath, bob)).json(), {
    invitation: { name: "Updated" },
  });
  assert.equal((await request(`/meet/${room.token}`, alice)).status, 200);
  assert.equal(
    (await request(roomPath, bob, "POST", { type: "join", name: "Bob" }))
      .status,
    200,
  );
  assert.equal(
    (
      await request(roomPath, bob, "POST", {
        type: "profile",
        name: "Bob",
        station: "横浜",
        people: 2,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(roomPath, bob, "POST", { type: "rotate" })).status,
    403,
  );
  const planned = await request(roomPath, alice, "POST", {
    type: "event",
    event: {
      id: "",
      title: "集合",
      date: "2026-12-10T19:00+09:00",
      station: "新宿",
      place: "",
      placeUrl: "",
      note: "",
      candidates: ["新宿", "横浜"],
    },
  });
  assert.equal(planned.status, 200, await planned.clone().text());
  const eventId = (await planned.json()).workspace.gatherings[0].id;
  assert.equal(
    (
      await request(roomPath, bob, "POST", {
        type: "vote",
        eventId,
        station: "新宿",
        vote: "yes",
      })
    ).status,
    200,
  );
  const answered = await request(roomPath, bob, "POST", {
    type: "attendance",
    eventId,
    attendance: "maybe",
  });
  assert.equal(answered.status, 200, await answered.clone().text());
  const { workspace: voted } = await answered.json();
  assert.equal(voted.gatherings[0].votes[voted.selfId].新宿, "yes");
  assert.equal(voted.gatherings[0].attendance[voted.selfId], "maybe");
  const history = {
    ...input,
    id: "smoke-history",
    bestName: "新宿",
    isFavorite: true,
  };
  assert.equal(
    (await request("/api/member-history", alice, "PUT", history)).status,
    200,
  );
  assert.equal(
    (await (await request("/api/member-history", alice)).json()).entries[0]
      .isFavorite,
    true,
  );
  assert.deepEqual(
    (await (await request("/api/member-history", bob)).json()).entries,
    [],
  );
  const exported = await (await request("/api/account/export", alice)).json();
  assert.equal(exported.groups[0].id, group.id);
  assert.equal(exported.history[0].id, history.id);

  // Exercise the actual backup command while both repositories are active.
  const backupPath = join(directory, "backup.sqlite");
  await promisify(execFile)(
    process.execPath,
    [".next/standalone/scripts/backupMembers.mjs", backupPath],
    {
      env: {
        ...process.env,
        MEMBER_DATABASE_PATH: join(directory, "members.sqlite"),
      },
    },
  );
  const backup = new Database(backupPath, { readonly: true });
  try {
    assert.equal(backup.pragma("integrity_check", { simple: true }), "ok");
    for (const table of ["member_groups", "workspaces", "member_history"])
      assert.equal(
        backup.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        1,
      );
  } finally {
    backup.close();
  }

  const rotated = await request(roomPath, alice, "POST", { type: "rotate" });
  assert.equal(rotated.status, 200, await rotated.clone().text());
  const newToken = (await rotated.json()).workspace.token;
  assert.notEqual(newToken, room.token);
  assert.equal((await request(roomPath, bob)).status, 404);
  roomPath = `/api/workspaces/${newToken}`;
  assert.equal(
    (await request(roomPath, bob, "POST", { type: "leave" })).status,
    200,
  );
  assert.equal(
    (await request(roomPath, alice, "POST", { type: "close" })).status,
    200,
  );
  assert.equal((await request(roomPath, alice)).status, 404);
  assert.equal(
    (await request("/api/member-history", alice, "DELETE", { id: history.id }))
      .status,
    204,
  );
  assert.equal(
    (await request(`/api/groups/${group.id}`, alice, "DELETE")).status,
    204,
  );
  assert.deepEqual(
    (await (await request("/api/groups", alice)).json()).groups,
    [],
  );
  console.log(
    "PASS: standalone session, groups, permissions, sharing, events, voting, attendance, history, export, live backup, invite rotation and cleanup (Google login is tested separately)",
  );
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once("exit", resolve);
  });
  rmSync(directory, { recursive: true, force: true });
}
