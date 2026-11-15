/** Normalize notation only, never guess a proper-name reading.
 * Small ヵ/ヶ have context-dependent readings, so leave them for review.
 */
export function normalizeStationKana(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/JR/gi, "じぇいあーる")
    .replace(/[ァ-ヴ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .trim();
}

/** Coordinates disambiguate stations with the same name. A 1km tolerance
 * also covers the curated station's slightly different representative point.
 */
export function findStationKanaOverride(station, overrides) {
  return overrides.find(entry => entry.name === station.name &&
    Math.hypot((station.lat - entry.lat) * 111000,
      (station.lng - entry.lng) * 111000 * Math.cos(entry.lat * Math.PI / 180)) < 1000);
}
