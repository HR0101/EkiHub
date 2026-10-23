import type { GroupConditions } from "./memberGroups";

export interface GroupPreferences {
  priority: "balanced" | "budget" | "transfers";
  spot: "none" | "cafe" | "restaurant" | "bar";
  note: string;
}
export interface WorkspaceMember {
  id: string;
  name: string;
  station: string;
  people: number;
}
export interface Gathering {
  id: string;
  title: string;
  date: string;
  station: string;
  place: string;
  placeUrl: string;
  note: string;
  candidates: string[];
  votes: Record<string, Record<string, "yes" | "no">>;
  attendance: Record<string, "yes" | "no" | "maybe">;
}
export interface Workspace {
  id: string;
  name: string;
  token: string;
  owner: boolean;
  selfId: string;
  conditions: GroupConditions;
  preferences: GroupPreferences;
  members: WorkspaceMember[];
  gatherings: Gathering[];
}
export const defaultPreferences: GroupPreferences = {
  priority: "balanced",
  spot: "none",
  note: "",
};
