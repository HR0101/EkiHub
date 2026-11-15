import { request } from "node:https";

/** Overpass is remote: avoid Node's short dual-stack connection attempts.
 * Keep this transport server-only; browsers use their normal fetch implementation.
 */
export const fetchOverpass: typeof fetch = (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", "EkiHub/1.0 (+https://ekihub.jp; nearby places)");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: init?.method ?? "GET",
        headers: Object.fromEntries(headers),
        family: 4,
        signal: init?.signal ?? undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 4 * 1024 * 1024) {
            req.destroy(new Error("Overpass response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks).toString("utf8"), {
              status: res.statusCode ?? 502,
              headers: {
                "Content-Type": String(
                  res.headers["content-type"] ?? "application/json",
                ),
              },
            }),
          ),
        );
      },
    );
    req.on("error", reject);
    req.end(typeof init?.body === "string" ? init.body : undefined);
  });
};
