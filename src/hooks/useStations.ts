"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { fetchCenterStation, fetchStations, prepareCenterSearch } from "@/lib/api";
import type { CenterRequest, CenterResult, Station } from "@/types/ekihub";

/** 駅マスタ。約8,000件あるので1度取ったら使い回す */
export function useStations() {
  const stations = useQuery<Station[]>({
    queryKey: ["stations"],
    queryFn: ({ signal }) => fetchStations(signal),
  });
  // 入力候補の取得は妨げない。複数の画面・再マウントでも同じ準備を共有する。
  // 失敗しても通常の検索には影響させず、入力のたびのリトライもしない。
  useQuery({
    queryKey: ["center-search-preparation"],
    queryFn: ({ signal }) => prepareCenterSearch(signal),
    enabled: stations.isSuccess,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return stations;
}

/**
 * 中心駅の算出。
 * 条件を変えるたびに投げ直すので、キャッシュではなく mutation で扱う。
 */
export function useCenterStation(options?: {
  onSuccess?: (result: CenterResult, request: CenterRequest) => void;
}) {
  return useMutation<CenterResult, Error, CenterRequest>({
    mutationFn: (request) => fetchCenterStation(request),
    onSuccess: options?.onSuccess,
  });
}
