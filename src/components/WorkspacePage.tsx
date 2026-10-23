"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemberAccount } from "@/hooks/useMemberGroups";
import { useStations } from "@/hooks/useStations";
import { workspaceRequest } from "@/lib/workspaceRequest";
import type { Gathering, Workspace } from "@/lib/memberWorkspace";
import { buildShareQuery } from "@/lib/shareUrl";

function localDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function offsetDate(value: string) {
  if (!value) return "";
  const d = new Date(value);
  const offset = -d.getTimezoneOffset();
  return `${value}${offset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
}
const blankEvent = {
  id: "",
  title: "",
  date: "",
  station: "",
  place: "",
  placeUrl: "",
  note: "",
  candidates: "",
};
export function WorkspacePage({ token }: { token: string }) {
  const router = useRouter();
  const account = useMemberAccount();
  const stations = useStations();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [eventForm, setEvent] = useState(blankEvent);
  const query = useQuery({
    queryKey: ["workspace", token, account.data?.user?.id],
    enabled: !!account.data?.user,
    retry: false,
    refetchInterval: 10000,
    queryFn: () =>
      workspaceRequest<{
        workspace?: Workspace;
        invitation?: { name: string };
      }>(`/api/workspaces/${encodeURIComponent(token)}`, {
        headers: { "X-EkiHub-Account": account.data!.user!.id },
      }),
  });
  const room = query.data?.workspace;
  const revealedHash = useRef("");
  useEffect(() => {
    if (!room) return;
    const hash = window.location.hash;
    if (hash && hash !== revealedHash.current) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView?.({ block: "start" });
        revealedHash.current = hash;
      }
    }
  }, [room]);
  const self = room?.members.find((m) => m.id === room.selfId);
  async function act(input: Record<string, unknown>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const data = await workspaceRequest<{
        workspace?: Workspace;
        left?: boolean;
        closed?: boolean;
      }>(`/api/workspaces/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EkiHub-Account": account.data!.user!.id,
        },
        body: JSON.stringify(input),
      });
      if (data.left || data.closed) {
        router.push("/account");
        return true;
      }
      if (data.workspace?.token !== token) {
        router.replace(`/meet/${data.workspace!.token}`);
        return true;
      }
      await query.refetch();
      setNotice("保存しました。");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function editEvent(e: Gathering) {
    setEvent({
      ...e,
      date: localDate(e.date),
      candidates: e.candidates.join("、"),
    });
    document.getElementById("gathering-title")?.focus();
  }
  const origins =
    room?.members
      .filter((m) => m.station)
      .map((m) => ({ name: m.station, people: m.people })) ?? [];
  const search =
    room && origins.length >= 2
      ? buildShareQuery({
          ...room.conditions,
          origins,
          fareWeight:
            room.preferences.priority === "budget"
              ? 0.8
              : room.conditions.fareWeight,
        })
      : null;
  return (
    <main className="app member-page">
      <Link className="nav-link" href="/account">
        ← マイグループ
      </Link>
      <h1>{room?.name ?? query.data?.invitation?.name ?? "集合ページ"}</h1>
      <p role="alert">
        {error || query.error?.message || account.error?.message}
      </p>
      <p role="status">{notice}</p>
      {account.isPending && <p>ログイン状態を確認しています…</p>}
      {!account.isPending && !account.data?.user && (
        <section className="panel">
          <p>招待されたGoogleアカウントでログインしてください。</p>
          <button
            className="btn btn--primary"
            disabled={busy || !account.data?.enabled}
            onClick={async () => {
              setBusy(true);
              try {
                await signIn("google", { redirectTo: `/meet/${token}` });
              } catch {
                setError("ログインできませんでした。");
                setBusy(false);
              }
            }}
          >
            Googleでログイン
          </button>
        </section>
      )}
      {query.isPending && account.data?.user && (
        <p>グループを読み込んでいます…</p>
      )}
      {query.isError && (
        <button className="tool-btn" onClick={() => query.refetch()}>
          再読み込み
        </button>
      )}
      {query.data?.invitation && (
        <section className="panel">
          <h2>グループへの招待</h2>
          <p>
            参加すると、登録した表示名・出発駅・人数・投票・参加予定がグループのメンバーに表示されます。リンクを知っている人は参加できます。信頼できる相手だけに共有してください。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void act({ type: "join", name: form.get("name") });
            }}
          >
            <label>
              表示名
              <input name="name" required maxLength={60} />
            </label>
            <button className="btn btn--primary" disabled={busy}>
              参加する
            </button>
          </form>
        </section>
      )}
      {room && (
        <>
          <section className="panel">
            <h2>招待リンク</h2>
            <p>
              このページのURLをメンバーに共有してください。予定ごとのリンクは各予定にあります。
            </p>
            <button
              className="tool-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/meet/${token}`,
                  );
                  setNotice("招待リンクをコピーしました。");
                } catch {
                  setError("アドレスバーのURLをコピーしてください。");
                }
              }}
            >
              招待リンクをコピー
            </button>
            {room.owner && (
              <button
                className="tool-btn"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "現在の招待URLを無効にして新しいURLに変更します。参加済みのメンバーは維持されます。",
                    )
                  )
                    void act({ type: "rotate" });
                }}
              >
                招待リンクを更新
              </button>
            )}
          </section>
          <div className="member-page__columns">
            <section className="panel">
              <h2>自分の出発駅</h2>
              <p>出発駅と人数は参加メンバーに共有されます。</p>
              <form
                key={`${self?.id}-${self?.station}-${self?.name}-${self?.people}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void act({
                    type: "profile",
                    name: form.get("name"),
                    station: form.get("station"),
                    people: Number(form.get("people")),
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    表示名
                    <input
                      name="name"
                      required
                      maxLength={60}
                      defaultValue={self?.name}
                    />
                  </label>
                  <label>
                    出発駅
                    <input
                      name="station"
                      list="workspace-stations"
                      required
                      defaultValue={self?.station}
                    />
                  </label>
                  <label>
                    人数
                    <select name="people" defaultValue={self?.people}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}人
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn--primary">出発駅を保存</button>
                </fieldset>
              </form>
              <datalist id="workspace-stations">
                {stations.data?.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              {stations.isError && (
                <button className="tool-btn" onClick={() => stations.refetch()}>
                  駅一覧を再読み込み
                </button>
              )}
              <h3>参加メンバー（{room.members.length}/20）</h3>
              <ul>
                {room.members.map((m) => (
                  <li key={m.id}>
                    {m.name} · {m.station || "駅未登録"} · {m.people}人
                  </li>
                ))}
              </ul>
              {search ? (
                <Link className="btn btn--primary" href={`/results?${search}`}>
                  登録された出発駅から検索
                </Link>
              ) : (
                <p>2人以上が駅を登録すると、全員の条件で検索できます。</p>
              )}
            </section>
            <section className="panel">
              <h2>グループの好み</h2>
              <p>
                予算重視は運賃の重みに反映します。乗り換え・お店の好みは候補を選ぶ際の共有条件として表示します。
              </p>
              <form
                key={JSON.stringify(room.preferences)}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void act({
                    type: "preferences",
                    preferences: {
                      priority: form.get("priority"),
                      spot: form.get("spot"),
                      note: form.get("note"),
                    },
                  });
                }}
              >
                <fieldset disabled={busy || !room.owner}>
                  <label>
                    重視すること
                    <select
                      name="priority"
                      defaultValue={room.preferences.priority}
                    >
                      <option value="balanced">バランス</option>
                      <option value="budget">安さ優先</option>
                      <option value="transfers">乗り換え少なめ</option>
                    </select>
                  </label>
                  <label>
                    周辺のお店
                    <select name="spot" defaultValue={room.preferences.spot}>
                      <option value="none">指定なし</option>
                      <option value="cafe">カフェ</option>
                      <option value="restaurant">レストラン</option>
                      <option value="bar">居酒屋・バー</option>
                    </select>
                  </label>
                  <label>
                    メモ
                    <textarea
                      name="note"
                      maxLength={500}
                      defaultValue={room.preferences.note}
                    />
                  </label>
                  {room.owner && (
                    <button className="btn btn--primary">好みを保存</button>
                  )}
                </fieldset>
              </form>
            </section>
          </div>
          {room.owner && (
            <section className="panel">
              <h2>{eventForm.id ? "予定を編集" : "集合の予定を作成"}</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act({
                      type: "event",
                      event: {
                        ...eventForm,
                        date: offsetDate(eventForm.date),
                        candidates: eventForm.candidates
                          .split(/[、,\n]/)
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    })
                  )
                    setEvent(blankEvent);
                }}
              >
                <fieldset disabled={busy}>
                  {(
                    [
                      ["title", "予定名"],
                      ["date", "日時（この端末のタイムゾーン）"],
                      ["station", "集合駅（未定でも可）"],
                      ["place", "お店・集合場所"],
                      ["placeUrl", "お店のURL（https）"],
                      ["candidates", "投票する候補駅（読点で区切り、1〜8駅）"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        id={key === "title" ? "gathering-title" : undefined}
                        list={
                          key === "station" ? "workspace-stations" : undefined
                        }
                        type={
                          key === "date"
                            ? "datetime-local"
                            : key === "placeUrl"
                              ? "url"
                              : "text"
                        }
                        value={eventForm[key]}
                        required={key === "title" || key === "candidates"}
                        maxLength={key === "placeUrl" ? 2000 : 1000}
                        onChange={(e) =>
                          setEvent({ ...eventForm, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    連絡事項
                    <textarea
                      maxLength={1000}
                      value={eventForm.note}
                      onChange={(e) =>
                        setEvent({ ...eventForm, note: e.target.value })
                      }
                    />
                  </label>
                  <button className="btn btn--primary">予定を保存</button>
                  {eventForm.id && (
                    <button
                      type="button"
                      className="tool-btn"
                      onClick={() => setEvent(blankEvent)}
                    >
                      編集をやめる
                    </button>
                  )}
                </fieldset>
              </form>
            </section>
          )}
          <h2>集合の予定・候補駅の投票</h2>
          {!room.gatherings.length && (
            <p>幹事が予定を作成すると、候補駅に投票できます。</p>
          )}
          {room.gatherings.map((event) => (
            <section className="panel" id={`event-${event.id}`} key={event.id}>
              <h3>{event.title}</h3>
              <p>
                {event.date
                  ? new Date(event.date).toLocaleString()
                  : "日時未定"}{" "}
                · {event.station || "集合駅未定"}
              </p>
              <p>{event.place}</p>
              {event.placeUrl && (
                <a
                  href={event.placeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  お店のページ
                </a>
              )}
              <p className="workspace-note">{event.note}</p>
              <a className="tool-btn" href={`#event-${event.id}`}>
                この予定のリンク
              </a>
              <button
                className="tool-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/meet/${token}#event-${event.id}`,
                    );
                    setNotice("予定のリンクをコピーしました。");
                  } catch {
                    setError(
                      "この予定のリンクを長押ししてコピーしてください。",
                    );
                  }
                }}
              >
                予定のURLをコピー
              </button>
              <h4>参加予定</h4>
              <div className="member-page__actions">
                {(
                  [
                    ["yes", "参加"],
                    ["maybe", "未定"],
                    ["no", "不参加"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className="tool-btn"
                    key={value}
                    aria-pressed={event.attendance[room.selfId] === value}
                    disabled={busy}
                    onClick={() =>
                      void act({
                        type: "attendance",
                        eventId: event.id,
                        attendance: value,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ul>
                {room.members.map((m) => (
                  <li key={m.id}>
                    {m.name}:{" "}
                    {{
                      yes: "参加",
                      no: "不参加",
                      maybe: "未定",
                      unanswered: "未回答",
                    }[event.attendance[m.id] ?? "unanswered"] || "未回答"}
                  </li>
                ))}
              </ul>
              <h4>候補駅に投票</h4>
              {event.candidates.map((s) => (
                <div className="workspace-candidate" key={s}>
                  <strong>{s}</strong>
                  <span>
                    ここがいい{" "}
                    {
                      Object.values(event.votes).filter((v) => v[s] === "yes")
                        .length
                    }{" "}
                    · 難しい{" "}
                    {
                      Object.values(event.votes).filter((v) => v[s] === "no")
                        .length
                    }
                  </span>
                  <div className="member-page__actions">
                    {(
                      [
                        ["yes", "ここがいい"],
                        ["no", "ここは難しい"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        className="tool-btn"
                        key={value}
                        disabled={busy}
                        aria-pressed={event.votes[room.selfId]?.[s] === value}
                        onClick={() =>
                          void act({
                            type: "vote",
                            eventId: event.id,
                            station: s,
                            vote:
                              event.votes[room.selfId]?.[s] === value
                                ? null
                                : value,
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {room.preferences.spot !== "none" && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s}駅 ${room.preferences.spot === "bar" ? "居酒屋" : room.preferences.spot === "cafe" ? "カフェ" : "レストラン"}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      好みに合うお店を探す
                    </a>
                  )}
                </div>
              ))}
              {room.owner && (
                <div className="member-page__actions">
                  <button className="tool-btn" onClick={() => editEvent(event)}>
                    予定を編集
                  </button>
                  <button
                    className="tool-btn"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("この予定と投票を削除しますか？"))
                        void act({ type: "deleteEvent", eventId: event.id });
                    }}
                  >
                    予定を削除
                  </button>
                </div>
              )}
            </section>
          ))}
          <section className="panel">
            <h2>グループの管理</h2>
            <button
              className="tool-btn"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    room.owner
                      ? "共有グループ・予定・投票・メンバー情報をすべて削除します。元の保存グループは残ります。終了しますか？"
                      : "登録した出発駅・投票・参加予定を削除して退会しますか？",
                  )
                )
                  void act({ type: room.owner ? "close" : "leave" });
              }}
            >
              {room.owner ? "共有グループを終了" : "このグループから退会"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
