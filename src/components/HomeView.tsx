"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";

import { LoadingOverlay } from "@/components/LoadingOverlay";
import { NearbySpots } from "@/components/NearbySpots";
import { Toolbar } from "@/components/PageChrome";
import { Ranking } from "@/components/Ranking";
import { ResultCard } from "@/components/ResultCard";
import { StationForm } from "@/components/StationForm";
import { TrainInformation } from "@/components/TrainInformation";
import { TravelList } from "@/components/TravelList";
import { useTranslation } from "@/i18n/LocaleProvider";
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
  }
);

/** トップページの本体。入力・算出・結果表示をまとめる */
export function HomeView() {
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
    onSuccess: (data) => {
      setResult(data);
      history.record({
        origins: data.origins.map((origin) => ({
          name: origin.name,
          people: origin.people,
        })),
        mode: data.mode,
        bestName: data.best.name,
      });
    },
  });

  const currentStation = useMemo(
    () => selectCurrentStation({ result, selectedName }),
    [result, selectedName]
  );
  const currentStep = useStepGuide(rows, result);

  const errorMessage = stationsQuery.isError
    ? t("form.stationsError")
    : centerMutation.isError
      ? // 算出APIのメッセージはサーバーが決めているのでそのまま出す
        centerMutation.error.message
      : null;

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

  return (
    <>
      <Toolbar
        history={{
          entries: history.entries,
          onToggleFavorite: history.toggleFavorite,
          onRemove: history.remove,
          onRestore: (entry) => {
            setRows(entry.origins);
            setMode(entry.mode);
          },
        }}
      />

      <div className="layout">
        <div className="sidebar">
          <StationForm
            stations={stationsQuery.data ?? []}
            isComputing={centerMutation.isPending}
            errorMessage={errorMessage}
            currentStep={currentStep}
            onSubmit={handleSubmit}
          />
          <TrainInformation />
        </div>

        <section className="result" aria-label={t("result.eyebrowBest")}>
          <ResultCard result={result} station={currentStation} />

          <StationMap result={result} station={currentStation} />

          {currentStation && (
            <TravelList travelTimes={currentStation.travelTimes} />
          )}

          {result && (
            <Ranking
              ranking={result.ranking}
              selectedName={currentStation?.name ?? null}
              onSelect={selectStation}
            />
          )}

          {currentStation && <NearbySpots station={currentStation} />}

          <LoadingOverlay isComputing={centerMutation.isPending} />
        </section>
      </div>
    </>
  );
}
