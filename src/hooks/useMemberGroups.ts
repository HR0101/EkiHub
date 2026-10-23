"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GroupConditions,
  MemberAccount,
  MemberGroup,
} from "@/lib/memberGroups";

async function memberRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "通信に失敗しました。");
  return data as T;
}
export function useMemberAccount() {
  return useQuery({
    queryKey: ["member-account"],
    queryFn: ({ signal }) =>
      memberRequest<MemberAccount>("/api/account", { signal }),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: false,
  });
}
export function useMemberGroups() {
  const account = useMemberAccount();
  return useQuery({
    queryKey: ["member-groups", account.data?.user?.id ?? null],
    enabled: account.isSuccess && Boolean(account.data?.user),
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) =>
      memberRequest<{ groups: MemberGroup[] }>("/api/groups", { signal }).then(
        (data) => data.groups,
      ),
  });
}
export function useSaveMemberGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string;
      input: GroupConditions & { name: string };
    }) =>
      memberRequest<{ group: MemberGroup }>(
        id ? `/api/groups/${encodeURIComponent(id)}` : "/api/groups",
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["member-groups"] }),
  });
}
export function useDeleteMemberGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      memberRequest<void>(`/api/groups/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["member-groups"] }),
  });
}
