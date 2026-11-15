"use client";
import Link from "next/link";
import { useMemberAccount, useMemberGroups } from "@/hooks/useMemberGroups";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { MemberGroup } from "@/lib/memberGroups";

export function SavedGroupsPanel({
  onSearch,
}: {
  onSearch: (group: MemberGroup) => void;
}) {
  const { t } = useTranslation();
  const account = useMemberAccount();
  const groups = useMemberGroups();
  if (account.isError || !account.data?.user) return null;
  return (
    <section
      className="member-groups panel"
      aria-label={t("member.groupsTitle")}
    >
      <div className="member-groups__heading">
        <h2>{t("member.groupsTitle")}</h2>
        <Link href="/account">{t("member.manage")}</Link>
      </div>
      {groups.isPending ? (
        <p role="status">{t("member.loading")}</p>
      ) : groups.isError ? (
        <p role="alert">
          {t("member.loadFailed")}{" "}
          <button className="tool-btn" onClick={() => groups.refetch()}>
            {t("member.retry")}
          </button>
        </p>
      ) : groups.data?.length ? (
        <ul className="member-groups__list">
          {groups.data.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className="member-groups__restore"
                onClick={() => onSearch(group)}
              >
                <strong>{group.name}</strong>
                <span>
                  {group.origins
                    .map(({ name, people }) => `${name} ×${people}`)
                    .join(" · ")}
                </span>
                <span className="member-groups__action">
                  {t("member.search")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {t("member.empty")}{" "}
          <Link href="/account">{t("member.saveCurrent")}</Link>
        </p>
      )}
    </section>
  );
}
