import type { GroupConditions } from "@/lib/memberGroups";
import { useEkiHubStore } from "@/stores/useEkiHubStore";

export function restoreMemberGroup(group: GroupConditions) {
  const state = useEkiHubStore.getState();
  state.setRows(group.origins);
  state.setMode(group.mode);
  state.setFairnessWeight(group.fairnessWeight);
  state.setFareWeight(group.fareWeight);
  state.setResult(null);
}
