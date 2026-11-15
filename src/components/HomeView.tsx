"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";

import { SavedGroupsPanel } from "@/components/SavedGroupsPanel";
import { restoreMemberGroup } from "@/lib/restoreMemberGroup";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { MeetingPoints } from "@/components/MeetingPoints";
import { NearbySpots } from "@/components/NearbySpots";
import { Hero, Toolbar } from "@/components/PageChrome";
import { Ranking } from "@/components/Ranking";
import { ResultCard } from "@/components/ResultCard";
import { StationForm } from "@/components/StationForm";
import { ThemeArtwork } from "@/components/ThemeArtwork";
import { TrainInformation } from "@/components/TrainInformation";
import { TravelList } from "@/components/TravelList";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSearchDraft } from "@/hooks/useSearchDraft";
import { buildShareQuery, parseShareParams } from "@/lib/shareUrl";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useShareParams } from "@/hooks/useShareParams";
import { useCenterStation, useStations } from "@/hooks/useStations";
import { useStepGuide } from "@/hooks/useStepGuide";
import {
  selectCurrentStation,
  selectFilledOrigins,
  useEkiHubStore,
} from "@/stores/useEkiHubStore";

/** 地図は Leaflet が window を触るため、クライアントでだけ読み込む */
const StationMap = dynamic(
  () => import("@/components/StationMap").then((m) => m.StationMap),
  {
    ssr: false,
    loading: () => <div className="map" />,
  },
);

/** トップページの本体。入力・算出・結果表示をまとめる */
export function HomeView({ page = "input" }: { page?: "input" | "results" }) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const isMobile = useIsMobile();
  const showingResults = !isMobile || page === "results";
  useSearchDraft();
  const resultRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const revealOnMobile = useCallback((element: HTMLElement | null) => {
    if (!element || !window.matchMedia("(max-width: 899px)").matches) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "start",
    });
    element.focus({ preventScroll: true });
  }, []);

  const navigateSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    if (isMobile) {
      event.preventDefault();
      revealOnMobile(document.getElementById(id));
    }
  };

  const editConditions = useCallback(() => {
    if (window.matchMedia("(max-width: 899px)").matches && page === "results") {
      router.push("/");
    } else {
      requestAnimationFrame(() => revealOnMobile(inputRef.current));
    }
  }, [page, router, revealOnMobile]);

  const rows = useEkiHubStore((state) => state.rows);
  // 算出時の条件は handleSubmit で getState() から直接読むので、ここでは購読しない
  const result = useEkiHubStore((state) => state.result);
  const selectedName = useEkiHubStore((state) => state.selectedName);
  const setResult = useEkiHubStore((state) => state.setResult);
  const setRows = useEkiHubStore((state) => state.setRows);
  const setMode = useEkiHubStore((state) => state.setMode);
  const selectStation = useEkiHubStore((state) => state.selectStation);

  const { t } = useTranslation();
  const history = useSearchHistory();
  const stationsQuery = useStations();
  const centerMutation = useCenterStation({
    onSuccess: (data, request) => {
      const query = buildShareQuery({
        origins: request.origins.map((name, index) => ({
          name,
          people: request.peopleCounts?.[index] ?? 1,
        })),
        mode: request.mode,
        fairnessWeight: request.weight ?? 0.6,
        fareWeight: request.fareWeight ?? 0,
      });
      setResult(data, query);
      const selected = new URLSearchParams(window.location.search).get(
        "station",
      );
      const incoming = parseShareParams(window.location.search);
      const incomingQuery = incoming
        ? buildShareQuery({
            origins: incoming.origins,
            mode: incoming.mode ?? request.mode,
            fairnessWeight: incoming.fairnessWeight ?? request.weight ?? 0.6,
            fareWeight: incoming.fareWeight ?? request.fareWeight ?? 0,
          })
        : null;
      const restoreSelection =
        page === "results" && incomingQuery === query && selected;
      if (restoreSelection) selectStation(restoreSelection);
      if (page === "results") {
        const stationParam = restoreSelection
          ? `&station=${encodeURIComponent(restoreSelection)}`
          : "";
        const target = `/results?${query}${stationParam}`;
        if (`${window.location.pathname}${window.location.search}` !== target)
          router.replace(target, { scroll: false });
      }
      if (window.matchMedia("(max-width: 899px)").matches && page === "input") {
        const target = `/results?${query}`;
        startNavigation(() => {
          if (parseShareParams(window.location.search)) router.replace(target);
          else router.push(target);
        });
      }
      history.record({
        origins: data.origins.map((origin) => ({
          name: origin.name,
          people: origin.people,
        })),
        mode: data.mode,
        bestName: data.best.name,
        fairnessWeight: request.weight ?? 0.6,
        fareWeight: request.fareWeight ?? 0,
      });
    },
  });

  const currentStation = useMemo(
    () => selectCurrentStation({ result, selectedName }),
    [result, selectedName],
  );
  const currentStep = useStepGuide(rows, result);

  const errorMessage = stationsQuery.isError
    ? t("form.stationsError")
    : centerMutation.isError
      ? // 算出APIのメッセージはサーバーが決めているのでそのまま出す
        centerMutation.error.message
      : null;

  const openResults = useCallback(() => {
    const state = useEkiHubStore.getState();
    if (state.resultQuery) {
      const selected = state.selectedName
        ? `&station=${encodeURIComponent(state.selectedName)}`
        : "";
      router.push(`/results?${state.resultQuery}${selected}`);
    }
  }, [router]);

  useEffect(() => {
    if (
      page === "results" &&
      !result &&
      !parseShareParams(window.location.search)
    )
      router.replace("/");
    if (page === "results" && result)
      resultRef.current?.focus({ preventScroll: true });
  }, [page, result, router]);

  const handleSubmit = useCallback(() => {
    // ストアの最新値を直接読む（共有リンクからの自動算出でも取りこぼさない）
    const state = useEkiHubStore.getState();
    const { origins, peopleCounts } = selectFilledOrigins(state.rows);
    centerMutation.mutate({
      origins,
      mode: state.mode,
      weight: state.fairnessWeight,
      fareWeight: state.fareWeight,
      peopleCounts,
    });
  }, [centerMutation]);

  // 共有リンクで開かれた場合は条件を復元してそのまま算出する
  useShareParams(handleSubmit);

  /** 例の組み合わせを入力欄へ流し込み、そのまま算出する */
  const handleQuickStart = useCallback(
    (origins: string[]) => {
      setRows(origins.map((name) => ({ name, people: 1 })));
      handleSubmit();
    },
    [setRows, handleSubmit],
  );

  return (
    <>
      <header
        className={`home-header ${page === "results" ? "home-header--results" : ""}`}
      >
        <div className="mobile-page-heading">
          {page === "results" ? (
            <>
              <button type="button" onClick={editConditions}>
                ← {t("form.editConditions")}
              </button>
              <h1>{t("result.pageTitle")}</h1>
              {result && (
                <p>{result.origins.map((origin) => origin.name).join(" · ")}</p>
              )}
            </>
          ) : (
            <p>{t("form.inputStep")}</p>
          )}
        </div>
        <div className="hero">
          <Hero />
        </div>
        <ThemeArtwork />
        {history.synced && (
          <div className="history-sync">
            <span>履歴・お気に入りをアカウントに同期中</span>
            {history.localCount > 0 && (
              <button className="tool-btn" onClick={history.importLocal}>
                この端末の履歴を取り込む（{history.localCount}件）
              </button>
            )}
          </div>
        )}
        {history.syncError && (
          <p role="alert">
            {history.syncError}
            <button className="tool-btn" onClick={history.retry}>
              再読み込み
            </button>
          </p>
        )}
        <Toolbar
          history={{
            entries: history.entries,
            onToggleFavorite: history.toggleFavorite,
            onRemove: history.remove,
            onRestore: (entry) => {
              setRows(entry.origins);
              setMode(entry.mode);
              useEkiHubStore
                .getState()
                .setFairnessWeight(entry.fairnessWeight ?? 0.6);
              useEkiHubStore.getState().setFareWeight(entry.fareWeight ?? 0);
              editConditions();
            },
          }}
        />
      </header>

      <div className={`layout layout--${page}`}>
        <div ref={inputRef} className="sidebar input-workspace" tabIndex={-1}>
          <div id="search-form" className="input-workspace__body">
            <SavedGroupsPanel
              onSearch={(group) => {
                restoreMemberGroup(group);
                handleSubmit();
              }}
            />
            <StationForm
              stations={stationsQuery.data ?? []}
              isComputing={centerMutation.isPending || isNavigating}
              errorMessage={errorMessage}
              currentStep={currentStep}
              onSubmit={handleSubmit}
            />
          </div>
          {result && (
            <button
              type="button"
              className="btn btn--ghost mobile-resume"
              onClick={openResults}
            >
              {t("result.returnToResults")}
            </button>
          )}
        </div>

        {isMobile && page === "input" && (
          <div className="mobile-start">
            <ResultCard
              result={null}
              station={null}
              onQuickStart={handleQuickStart}
            />
          </div>
        )}

        {showingResults && (
          <section
            ref={resultRef}
            className="result result--main result-sheet"
            aria-label={t("result.eyebrowBest")}
            aria-busy={centerMutation.isPending}
            tabIndex={-1}
          >
            {page === "results" && !result && (
              <div className="result-recovery" role="status">
                <h2>
                  {t(
                    centerMutation.isError
                      ? "result.failedTitle"
                      : "form.computing",
                  )}
                </h2>
                {errorMessage && <p role="alert">{errorMessage}</p>}
                {centerMutation.isError && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={editConditions}
                  >
                    {t("form.editConditions")}
                  </button>
                )}
              </div>
            )}
            {result && (
              <nav
                className="result-navigation"
                aria-label={t("result.navigation")}
              >
                <a
                  href="#result-overview"
                  onClick={(event) => navigateSection(event, "result-overview")}
                >
                  {t("result.overview")}
                </a>
                {currentStation && currentStation.travelTimes.length > 0 && (
                  <a
                    href="#travel-times"
                    onClick={(event) => navigateSection(event, "travel-times")}
                  >
                    {t("ranking.minutes")}
                  </a>
                )}
                {result.ranking.length > 1 && (
                  <a
                    href="#station-comparison"
                    onClick={(event) =>
                      navigateSection(event, "station-comparison")
                    }
                  >
                    {t("ranking.comparisonTitle")}
                  </a>
                )}
                <button
                  type="button"
                  className="result-navigation__edit"
                  onClick={editConditions}
                >
                  {t("form.editConditions")}
                </button>
              </nav>
            )}
            {(page !== "results" || result) && (
              <div className="result-overview" id="result-overview">
                <ResultCard
                  result={result}
                  station={currentStation}
                  onQuickStart={handleQuickStart}
                />
                <section className="result-map" aria-label={t("map.ariaLabel")}>
                  <h3 className="result-map__title">{t("map.ariaLabel")}</h3>
                  <StationMap result={result} station={currentStation} />
                </section>
              </div>
            )}

            {currentStation && (
              <TravelList travelTimes={currentStation.travelTimes} />
            )}

            {result && (
              <Ranking
                ranking={result.ranking}
                selectedName={currentStation?.name ?? null}
                onSelect={(name) => {
                  selectStation(name);
                  if (
                    page === "results" &&
                    window.matchMedia("(max-width: 899px)").matches
                  ) {
                    const query = useEkiHubStore.getState().resultQuery;
                    if (query)
                      router.replace(
                        `/results?${query}&station=${encodeURIComponent(name)}`,
                        { scroll: false },
                      );
                  }
                  requestAnimationFrame(() =>
                    revealOnMobile(resultRef.current),
                  );
                }}
              />
            )}

            {currentStation && <MeetingPoints station={currentStation} />}
            {currentStation && <NearbySpots station={currentStation} />}

            <div className="result-service">
              <TrainInformation />
            </div>
            <LoadingOverlay
              isComputing={centerMutation.isPending || isNavigating}
            />
          </section>
        )}
      </div>
    </>
  );
}
