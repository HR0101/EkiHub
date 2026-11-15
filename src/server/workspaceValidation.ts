import { MemberApiError } from "./memberApi";
import { loadStationIndex } from "./stationRepository";
export function text(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new MemberApiError("入力内容と文字数を確認してください。", 400);
  return value.trim();
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  // Read streams with a limit even when content-length is absent or forged.
  const reader = request.body?.getReader();
  if (!reader) throw new MemberApiError("入力がありません。", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32000) {
      await reader.cancel();
      throw new MemberApiError("入力が大きすぎます。", 413);
    }
    chunks.push(value);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data;
  } catch {
    throw new MemberApiError("入力内容を確認してください。", 400);
  }
}
export async function station(value: unknown, optional = false) {
  const name = text(value, 120, !optional);
  if (name && !(await loadStationIndex()).has(name))
    throw new MemberApiError("登録されている駅を選択してください。", 400);
  return name;
}
export async function actionInput(request: Request) {
  const a = await body(request);
  const type = text(a.type, 30, true);
  if (type === "join") return { type, name: text(a.name, 60, true) };
  if (type === "profile") {
    if (
      !Number.isInteger(a.people) ||
      Number(a.people) < 1 ||
      Number(a.people) > 10
    )
      throw new MemberApiError("人数は1〜10人です。", 400);
    return {
      type,
      name: text(a.name, 60, true),
      station: await station(a.station),
      people: a.people,
    };
  }
  if (["rotate", "close", "leave"].includes(type)) return { type };
  if (type === "preferences") {
    const p = a.preferences as Record<string, unknown> | null;
    if (
      !p ||
      !["balanced", "budget", "transfers"].includes(String(p.priority)) ||
      !["none", "cafe", "restaurant", "bar"].includes(String(p.spot))
    )
      throw new MemberApiError("好みを選択してください。", 400);
    return {
      type,
      preferences: {
        priority: p.priority,
        spot: p.spot,
        note: text(p.note, 500),
      },
    };
  }
  if (type === "event") {
    const e = a.event as Record<string, unknown> | null;
    if (
      !e ||
      !Array.isArray(e.candidates) ||
      e.candidates.length < 1 ||
      e.candidates.length > 8
    )
      throw new MemberApiError("候補駅は1〜8駅です。", 400);
    const candidates = [
      ...new Set(await Promise.all(e.candidates.map((v) => station(v)))),
    ];
    const date = text(e.date, 40);
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)))
    )
      throw new MemberApiError("日時を確認してください。", 400);
    const placeUrl = text(e.placeUrl, 2000);
    if (placeUrl) {
      try {
        if (new URL(placeUrl).protocol !== "https:") throw Error();
      } catch {
        throw new MemberApiError("お店のURLはhttpsで入力してください。", 400);
      }
    }
    return {
      type,
      event: {
        id: text(e.id ?? "", 100),
        title: text(e.title, 100, true),
        date,
        station: await station(e.station, true),
        place: text(e.place, 200),
        placeUrl,
        note: text(e.note, 1000),
        candidates,
      },
    };
  }
  const eventId = text(a.eventId, 100, true);
  if (type === "deleteEvent") return { type, eventId };
  if (
    type === "attendance" &&
    ["yes", "no", "maybe"].includes(String(a.attendance))
  )
    return { type, eventId, attendance: a.attendance };
  if (
    type === "vote" &&
    (a.vote === null || a.vote === "yes" || a.vote === "no")
  )
    return { type, eventId, station: await station(a.station), vote: a.vote };
  throw new MemberApiError("操作を確認してください。", 400);
}
