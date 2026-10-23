import Database from "better-sqlite3";
import { mkdir, chmod, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";

// Read-only source: never create an empty database when the path is wrong.
const source = resolve(
  process.env.MEMBER_DATABASE_PATH || "var/members.sqlite",
);
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Usage: npm run backup:members -- /secure/path/backup.sqlite",
  );
const target = resolve(destination);
if (target === source)
  throw new Error("Backup destination must differ from the live database.");
process.umask(0o077);
await mkdir(dirname(target), { recursive: true, mode: 0o700 });
// Refuse overwrite, including existing backups and symlinks.
const { open } = await import("node:fs/promises");
const reservation = await open(target, "wx", 0o600);
await reservation.close();
let db;
try {
  db = new Database(source, { readonly: true, fileMustExist: true });
  await db.backup(target);
  const backup = new Database(target, { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma("integrity_check", { simple: true }) !== "ok")
      throw new Error("Backup integrity check failed.");
    backup.prepare("SELECT COUNT(*) FROM member_groups").get();
  } finally {
    backup.close();
  }
  await chmod(target, 0o600);
  console.log("Member database backup verified.");
} catch (error) {
  await rm(target, { force: true });
  throw error;
} finally {
  db?.close();
}
