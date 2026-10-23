/** Assemble the standalone runtime and fail before shipping private files. */
import { cp, readdir, lstat, readlink, rm } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";

const root = resolve(".next/standalone");
async function inspect(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await lstat(path);
    if (
      name.startsWith(".env") ||
      /\.sqlite(?:$|[.-])/.test(name) ||
      (directory === root && name === "var")
    ) {
      throw new Error(
        `Private runtime file in bundle: ${relative(root, path)}`,
      );
    }
    if (info.isSymbolicLink()) {
      const target = resolve(directory, await readlink(path));
      const outside = relative(root, target);
      if (outside === ".." || outside.startsWith("../") || isAbsolute(outside))
        throw new Error(`External symlink in bundle: ${relative(root, path)}`);
    } else if (info.isDirectory()) await inspect(path);
  }
}
// Next copies .env and .env.production into standalone even when tracing excludes
// them. Runtime secrets are supplied by the host, so remove these generated copies.
for (const name of [".env", ".env.production"]) {
  await rm(join(root, name), { force: true });
}
await inspect(root);
await cp(".next/static", join(root, ".next/static"), { recursive: true });
await cp("public", join(root, "public"), { recursive: true });
await cp("data", join(root, "data"), { recursive: true });
await cp("scripts/backupMembers.mjs", join(root, "scripts/backupMembers.mjs"), {
  recursive: true,
});
await inspect(root);
// Ship the runtime used to build and test the native SQLite module.
await cp(process.execPath, join(root, "node"));
console.log(
  `Standalone bundle assembled with Node ${process.version}; no environment files or member databases.`,
);
