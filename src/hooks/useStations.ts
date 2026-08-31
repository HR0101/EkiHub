"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { fetchCenterStation, fetchStations } from "@/lib/api";
import type { CenterRequest, CenterResult, Station } from "@/types/ekihub";

/** 駅マスタ。約8,000件あるので1度取ったら使い回す */
export function useStations() {
  return useQuery<Station[]>({
    queryKey: ["stations"],
    queryFn: ({ signal }) => fetchStations(signal),
  });
}

/**
 * 中心駅の算出。
 * 条件を変えるたびに投げ直すので、キャッシュではなく mutation で扱う。
 */
export function useCenterStation(options?: {
  onSuccess?: (result: CenterResult) => void;
}) {
  return useMutation<CenterResult, Error, CenterRequest>({
    mutationFn: (request) => fetchCenterStation(request),
    onSuccess: options?.onSuccess,
  });
}
