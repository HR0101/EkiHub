"use client";
import Link from "next/link";
import { workspaceRequest } from "@/lib/workspaceRequest";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemberAccount } from "@/hooks/useMemberGroups";
import type { MemberGroup } from "@/lib/memberGroups";
import { useState } from "react";
export function MemberWorkspaces({ groups }: { groups: MemberGroup[] }) {
  const account = useMemberAccount();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["workspaces", account.data?.user?.id],
    enabled: !!account.data?.user,
    queryFn: () =>
      workspaceRequest<{
        workspaces: {
          id: string;
          name: string;
          token: string;
          owner: boolean;
        }[];
      }>("/api/workspaces"),
  });
  const create = useMutation({
    mutationFn: (groupId: string) =>
      workspaceRequest("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["workspaces"] }),
  });
  return (
    <section className="panel member-collaboration">
      <h2>共有グループ・集合の予定</h2>
      <p>
        招待リンクから参加したメンバーと、出発駅・候補駅への投票・予定を共有できます。
      </p>
      {error && <p role="alert">{error}</p>}
      {query.isError && (
        <button className="tool-btn" onClick={() => query.refetch()}>
          一覧を再読み込み
        </button>
      )}
      <ul>
        {query.data?.workspaces.map((room) => (
          <li key={room.id}>
            <Link href={`/meet/${room.token}`}>
              {room.name} — 集合ページを開く
            </Link>
          </li>
        ))}
      </ul>
      {groups
        .filter((g) => !query.data?.workspaces.some((r) => r.id === g.id))
        .map((g) => (
          <button
            className="tool-btn"
            disabled={create.isPending || query.isPending}
            key={g.id}
            onClick={async () => {
              setError("");
              try {
                await create.mutateAsync(g.id);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {g.name}を共有グループにする
          </button>
        ))}
      {!groups.length && !query.data?.workspaces.length && (
        <p>
          まず検索条件をグループに保存してください。招待されたグループもここに表示されます。
        </p>
      )}
    </section>
  );
}
