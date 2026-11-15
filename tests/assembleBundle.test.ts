import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

const script = resolve("scripts/assembleBundle.mjs");
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "ekihub-bundle-"));
  for (const path of [
    ".next/standalone",
    ".next/static",
    "public",
    "data",
    "scripts",
  ])
    mkdirSync(join(directory, path), { recursive: true });
  writeFileSync(join(directory, "scripts/backupMembers.mjs"), "// backup tool");
  writeFileSync(join(directory, "public/asset.txt"), "public asset");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function assemble() {
  return execFileSync(process.execPath, [script], {
    cwd: directory,
    stdio: "pipe",
  });
}
it("removes Next's environment copies and includes the backup tool and assets", () => {
  for (const name of [".env", ".env.production"])
    writeFileSync(join(directory, ".next/standalone", name), "PRIVATE=test");
  assemble();
  expect(existsSync(join(directory, ".next/standalone/.env"))).toBe(false);
  expect(existsSync(join(directory, ".next/standalone/.env.production"))).toBe(
    false,
  );
  expect(
    readFileSync(join(directory, ".next/standalone/public/asset.txt"), "utf8"),
  ).toBe("public asset");
  expect(
    existsSync(join(directory, ".next/standalone/scripts/backupMembers.mjs")),
  ).toBe(true);
});
it.each(["members.sqlite", "members.sqlite-wal", ".env.local"])(
  "rejects private file %s in copied application data",
  (name) => {
    writeFileSync(join(directory, "data", name), "private");
    expect(assemble).toThrow("Private runtime file in bundle");
  },
);
it("rejects symlinks outside the deployment directory", () => {
  symlinkSync(directory, join(directory, ".next/standalone/external"));
  expect(assemble).toThrow("External symlink in bundle");
});
