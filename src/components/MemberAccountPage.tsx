"use client";

import Link from "next/link";
import { MemberWorkspaces } from "@/components/MemberWorkspaces";
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { StationInputRow } from "@/components/StationInputRow";
import { Footer, Toolbar } from "@/components/PageChrome";
import {
  useMemberAccount,
  useMemberGroups,
  useSaveMemberGroup,
  useDeleteMemberGroup,
} from "@/hooks/useMemberGroups";
import { useStations } from "@/hooks/useStations";
import { useSearchDraft } from "@/hooks/useSearchDraft";
import { useTranslation } from "@/i18n/LocaleProvider";
import { parseGroupInput, type MemberGroup } from "@/lib/memberGroups";
import { restoreMemberGroup } from "@/lib/restoreMemberGroup";
import { buildShareQuery } from "@/lib/shareUrl";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

export function MemberAccountPage({
  authError = false,
}: {
  authError?: boolean;
}) {
  useSearchDraft();
  const { t } = useTranslation();
  const account = useMemberAccount();
  const groups = useMemberGroups();
  const stations = useStations();
  const save = useSaveMemberGroup();
  const remove = useDeleteMemberGroup();
  const [groupName, setGroupName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(authError ? t("member.authError") : "");
  const [authBusy, setAuthBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string>();
  const rows = useEkiHubStore((s) => s.rows);
  const mode = useEkiHubStore((s) => s.mode);
  const fairnessWeight = useEkiHubStore((s) => s.fairnessWeight);
  const fareWeight = useEkiHubStore((s) => s.fareWeight);
  const addRow = useEkiHubStore((s) => s.addRow);
  const setMode = useEkiHubStore((s) => s.setMode);
  const setFairnessWeight = useEkiHubStore((s) => s.setFairnessWeight);
  const setFareWeight = useEkiHubStore((s) => s.setFareWeight);

  function edit(group: MemberGroup) {
    restoreMemberGroup(group);
    setEditingId(group.id);
    setGroupName(group.name);
    setNotice("");
    setError("");
    document.getElementById("group-name")?.focus();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    try {
      const input = parseGroupInput({
        name: groupName,
        origins: rows
          .filter((row) => row.name.trim())
          .map(({ name, people }) => ({ name, people })),
        mode,
        fairnessWeight,
        fareWeight,
      });
      await save.mutateAsync({ id: editingId, input });
      setNotice(t("member.saved"));
      setEditingId(undefined);
      setGroupName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("member.error"));
    }
  }
  async function deleteGroup(id: string) {
    setError("");
    try {
      await remove.mutateAsync(id);
      setDeleteId(undefined);
      if (editingId === id) {
        setEditingId(undefined);
        setGroupName("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("member.error"));
    }
  }
  async function authenticate(logout = false) {
    setAuthBusy(true);
    setError("");
    try {
      if (logout) await signOut({ redirectTo: "/account" });
      else await signIn("google", { redirectTo: "/account" });
    } catch {
      setError(t("member.authError"));
      setAuthBusy(false);
    }
  }
  const busy = save.isPending || remove.isPending;
  return (
    <main className="app home-app member-page">
      <header className="member-page__header">
        <Link href="/" className="nav-link">
          ← {t("member.back")}
        </Link>
        <Toolbar />
      </header>
      <div className="member-page__intro">
        <span className="hero__badge">MY GROUPS</span>
        <h1>{t("member.title")}</h1>
        <p>{t("member.lead")}</p>
      </div>
      {error && (
        <p className="member-message member-message--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="member-message" role="status">
          {notice}
        </p>
      )}
      {account.isPending ? (
        <p role="status">{t("member.loading")}</p>
      ) : account.isError ? (
        <p role="alert">
          {t("member.loadFailed")}{" "}
          <button className="tool-btn" onClick={() => account.refetch()}>
            {t("member.retry")}
          </button>
        </p>
      ) : !account.data?.user ? (
        <section className="panel member-login">
          <h2>{t("member.loginTitle")}</h2>
          <p>{t("member.loginDescription")}</p>
          {account.data?.enabled ? (
            <button
              className="btn btn--primary"
              disabled={authBusy}
              onClick={() => authenticate()}
            >
              {t(authBusy ? "member.loginBusy" : "member.login")}
            </button>
          ) : (
            <p role="status">{t("member.unavailable")}</p>
          )}
          <p className="member-page__muted">{t("member.loginNote")}</p>
          <Link href="/privacy">{t("member.privacy")}</Link>
        </section>
      ) : (
        <>
          <div className="member-page__identity">
            <p>
              {t("member.signedIn")} · {account.data.user.name ?? "Google"}
            </p>
            <button
              className="tool-btn"
              disabled={authBusy || busy}
              onClick={() => authenticate(true)}
            >
              {t("member.logout")}
            </button>
          </div>
          <MemberWorkspaces groups={groups.data ?? []} />
          <div className="member-page__columns">
            <section className="panel member-editor">
              <h2>{t(editingId ? "member.editing" : "member.newGroup")}</h2>
              <p>{t("member.createHint")}</p>
              <form onSubmit={submit}>
                <fieldset disabled={busy}>
                  <label className="member-editor__name" htmlFor="group-name">
                    {t("member.name")}
                    <input
                      id="group-name"
                      value={groupName}
                      maxLength={60}
                      required
                      placeholder={t("member.namePlaceholder")}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </label>
                  <h3>{t("member.conditions")}</h3>
                  {rows.map((row, index) => (
                    <StationInputRow
                      key={row.id}
                      row={row}
                      index={index + 1}
                      stations={stations.data ?? []}
                    />
                  ))}
                  <button
                    className="tool-btn"
                    type="button"
                    onClick={addRow}
                    disabled={rows.length >= 20}
                  >
                    {t("form.addStation")}
                  </button>
                  <label>
                    {t("form.modeTitle")}
                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value === "A" ? "A" : "B")
                      }
                    >
                      <option value="A">{t("form.modeAMain")}</option>
                      <option value="B">{t("form.modeBMain")}</option>
                    </select>
                  </label>
                  <label>
                    {t("form.weightTitle")} · {Math.round(fairnessWeight * 100)}
                    %
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(fairnessWeight * 100)}
                      onChange={(e) =>
                        setFairnessWeight(Number(e.target.value) / 100)
                      }
                    />
                  </label>
                  <label>
                    {t("form.fareTitle")} · {Math.round(fareWeight * 100)}%
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(fareWeight * 100)}
                      onChange={(e) =>
                        setFareWeight(Number(e.target.value) / 100)
                      }
                    />
                  </label>
                  <div className="member-page__actions">
                    <button
                      className="btn btn--primary"
                      disabled={busy || !stations.data?.length}
                    >
                      {t(
                        save.isPending
                          ? "member.saving"
                          : editingId
                            ? "member.update"
                            : "member.save",
                      )}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        className="tool-btn"
                        onClick={() => {
                          setEditingId(undefined);
                          setGroupName("");
                        }}
                      >
                        {t("member.cancel")}
                      </button>
                    )}
                  </div>
                  {stations.isError && (
                    <p role="alert">
                      {t("member.loadFailed")}{" "}
                      <button type="button" onClick={() => stations.refetch()}>
                        {t("member.retry")}
                      </button>
                    </p>
                  )}
                </fieldset>
              </form>
            </section>
            <section className="panel member-library">
              <h2>{t("member.groupsTitle")}</h2>
              <a className="tool-btn" href="/api/account/export" download>
                {t("member.export")}
              </a>
              <p>{t("member.limit")}</p>
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
                <ul className="member-library__list">
                  {groups.data.map((group) => (
                    <li key={group.id}>
                      <h3>{group.name}</h3>
                      <p>
                        {group.origins
                          .map(({ name, people }) => `${name} ×${people}`)
                          .join(" · ")}
                      </p>
                      <div className="member-page__actions">
                        <Link
                          href={`/results?${buildShareQuery(group)}`}
                          className="btn btn--primary"
                        >
                          {t("member.search")}
                        </Link>
                        <button
                          type="button"
                          className="tool-btn"
                          disabled={busy}
                          onClick={() => edit(group)}
                        >
                          {t("member.edit")}
                        </button>
                        <button
                          type="button"
                          className="tool-btn"
                          disabled={busy}
                          onClick={() => setDeleteId(group.id)}
                        >
                          {t("member.delete")}
                        </button>
                      </div>
                      {deleteId === group.id && (
                        <div
                          className="member-delete"
                          role="group"
                          aria-label={t("member.deleteConfirm")}
                        >
                          <p>{t("member.deleteConfirm")}</p>
                          <button
                            type="button"
                            className="tool-btn"
                            disabled={busy}
                            onClick={() => deleteGroup(group.id)}
                          >
                            {t(
                              remove.isPending
                                ? "member.deleteBusy"
                                : "member.delete",
                            )}
                          </button>
                          <button
                            type="button"
                            className="tool-btn"
                            disabled={busy}
                            onClick={() => setDeleteId(undefined)}
                          >
                            {t("member.cancel")}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("member.empty")}</p>
              )}
            </section>
          </div>
        </>
      )}
      <Footer />
    </main>
  );
}
