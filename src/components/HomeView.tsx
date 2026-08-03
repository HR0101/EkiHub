"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Ranking } from "@/components/Ranking";
import { ResultCard } from "@/components/ResultCard";
import { StationForm } from "@/components/StationForm";
import { TravelList } from "@/components/TravelList";
import { useCenterStation, useStations } from "@/hooks/useStations";
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
    loading: () => <div className="map" aria-label="地図を読み込み中" />,
  }
);

/** トップページの本体。入力・算出・結果表示をまとめる */
export function HomeView() {
  const rows = useEkiHubStore((state) => state.rows);
  const mode = useEkiHubStore((state) => state.mode);
  const fairnessWeight = useEkiHubStore((state) => state.fairnessWeight);
  const fareWeight = useEkiHubStore((state) => state.fareWeight);
  const result = useEkiHubStore((state) => state.result);
  const selectedName = useEkiHubStore((state) => state.selectedName);
  const setResult = useEkiHubStore((state) => state.setResult);
  const selectStation = useEkiHubStore((state) => state.selectStation);

  const stationsQuery = useStations();
  const centerMutation = useCenterStation({ onSuccess: setResult });

  const currentStation = useMemo(
    () => selectCurrentStation({ result, selectedName }),
    [result, selectedName]
  );

  const errorMessage = stationsQuery.isError
    ? "駅データを読み込めませんでした。ページを再読み込みしてください。"
    : centerMutation.isError
      ? centerMutation.error.message
      : null;

  function handleSubmit() {
    const { origins, peopleCounts } = selectFilledOrigins(rows);
    centerMutation.mutate({
      origins,
      mode,
      weight: fairnessWeight,
      fareWeight,
      peopleCounts,
    });
  }

  return (
    <div className="layout">
      <div className="sidebar">
        <StationForm
          stations={stationsQuery.data ?? []}
          isComputing={centerMutation.isPending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
        />
      </div>

      <section className="result" aria-label="結果表示">
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

        <LoadingOverlay isComputing={centerMutation.isPending} />
      </section>
    </div>
  );
}
