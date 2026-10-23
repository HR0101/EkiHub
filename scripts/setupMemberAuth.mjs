/** Creates local-only configuration without displaying secrets. */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(
    "Node.js 24以上で実行してください。macOSでは /opt/homebrew/opt/node@24/bin/node scripts/setupMemberAuth.mjs も利用できます。",
  );
  process.exit(1);
}
const address = new URL(process.argv[2] || "http://localhost:3001");
if (
  (address.protocol !== "https:" &&
    !(
      address.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(address.hostname)
    )) ||
  address.pathname !== "/" ||
  address.search ||
  address.hash ||
  address.username ||
  address.password
)
  throw new Error(
    "公開するオリジンURLを指定してください（例：http://localhost:3001）。",
  );
const file = ".env.local";
let local = existsSync(file) ? readFileSync(file, "utf8") : "";
function readValues(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^[ \t]*([A-Z_]+)[ \t]*=[ \t]*(.*)$/);
    if (match)
      values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}
const existing = {
  ...readValues(existsSync(".env") ? readFileSync(".env", "utf8") : ""),
  ...readValues(local),
};
const hasValue = (key) => Boolean(existing[key]);
const additions = [];
if (!hasValue("AUTH_SECRET"))
  additions.push(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
if (!hasValue("AUTH_URL")) additions.push(`AUTH_URL=${address.origin}`);
for (const key of ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]) {
  if (!(key in existing)) additions.push(`${key}=`);
}
if (additions.length) {
  local +=
    "\n# Google login (local only; do not commit)\n" +
    additions.join("\n") +
    "\n";
  writeFileSync(file, local, { mode: 0o600 });
  chmodSync(file, 0o600);
}
console.log(
  ".env.localを準備しました。AUTH_GOOGLE_ID と AUTH_GOOGLE_SECRET を設定してサーバーを再起動してください。",
);
console.log(
  `Googleに登録するリダイレクトURI: ${new URL(existing.AUTH_URL || address.origin).origin}/api/auth/callback/google`,
);
