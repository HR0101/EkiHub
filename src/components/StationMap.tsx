"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { useTranslation } from "@/i18n/LocaleProvider";
import { readThemeColors } from "@/lib/cssVar";
import type { CenterResult, RankingEntry } from "@/types/ekihub";

interface Props {
  result: CenterResult | null;
  station: RankingEntry | null;
}

/**
 * 白基調のUIに合わせた明るいタイル（国土地理院の淡色地図）。
 * キー不要で、出典の表示だけで使える。CARTO はキー無しだと
 * 「API KEY REQUIRED」の透かし画像を返すようになったため切り替えた（#91）。
 * 提供元を変えるときは next.config.ts の CSP（img-src）、
 * データ出典・プライバシーポリシーのページ、deploy.yml のタイル確認も揃えること。
 */
const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';

/** 鉄道路線のオーバーレイ */
const RAILWAY_TILE_URL =
  "https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png";

/** 初期表示は東京駅。結果が出たら bounds で上書きされる */
const DEFAULT_CENTER: [number, number] = [35.681382, 139.766084];
const DEFAULT_ZOOM = 10;
const MAX_FIT_ZOOM = 14;

/** 入力駅と候補駅を結ぶ点線。色は CSS 変数から取る（テーマに追従させるため） */
const LINK_LINE_SHAPE = {
  weight: 1.5,
  opacity: 0.4,
  dashArray: "4 6",
};

/** 数字入りの丸ピン（CSS の .pin で描く） */
function makePin(html: string, className: string, size: number) {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${className}">${html}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** 表示範囲を全ピンが入るように合わせる */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (
      points.length === 0 ||
      map.getContainer().clientWidth === 0 ||
      map.getContainer().clientHeight === 0
    )
      return;
    // padding はピンの中心を基準に効くので、アイコンの半径（19px）ぶん多めに取る
    map.invalidateSize({ pan: false });
    map.fitBounds(L.latLngBounds(points), {
      padding: [64, 64],
      animate: false,
      maxZoom: MAX_FIT_ZOOM,
    });
  }, [map, points]);

  useEffect(() => {
    let active = true;
    const observer = new ResizeObserver(() => {
      if (
        !active ||
        !map.getPane("mapPane") ||
        map.getContainer().clientWidth === 0 ||
        map.getContainer().clientHeight === 0
      )
        return;
      map.invalidateSize({ pan: false });
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), {
          padding: [40, 40],
          maxZoom: MAX_FIT_ZOOM,
          animate: false,
        });
      }
    });
    observer.observe(map.getContainer());
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [map, points]);

  return null;
}

/** 位置関係マップ。入力駅・候補駅・重心を1枚に重ねる */
export function StationMap({ result, station }: Props) {
  const { t } = useTranslation();
  // Repaint vector overlays as soon as the user switches designs.
  const [colors, setColors] = useState(readThemeColors);
  useEffect(() => {
    const update = () => setColors(readThemeColors());
    window.addEventListener("ekihub-design-change", update);
    return () => window.removeEventListener("ekihub-design-change", update);
  }, []);
  const center = station ?? result?.best ?? null;

  const points = useMemo<[number, number][]>(() => {
    if (!result || !center) return [];
    return [
      ...result.origins.map(
        (origin) => [origin.lat, origin.lng] as [number, number],
      ),
      [center.lat, center.lng],
      [result.centroid.lat, result.centroid.lng],
    ];
  }, [result, center]);

  const isTop = Boolean(result && center && result.best.name === center.name);

  return (
    <MapContainer
      className="map"
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      aria-label={t("map.ariaLabel")}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <TileLayer
        url={RAILWAY_TILE_URL}
        attribution='鉄道: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
        opacity={0.7}
      />

      {result &&
        center &&
        result.origins.map((origin, index) => (
          <Fragment key={origin.name}>
            <Marker
              position={[origin.lat, origin.lng]}
              icon={makePin(String(index + 1), "pin--origin", 26)}
            >
              <Popup>
                <b>{origin.name}</b>
                <br />
                {t("map.origin", { index: index + 1 })}
                {origin.people > 1 &&
                  t("map.originPeople", { count: origin.people })}
              </Popup>
            </Marker>
            <Polyline
              positions={[
                [origin.lat, origin.lng],
                [center.lat, center.lng],
              ]}
              pathOptions={{ ...LINK_LINE_SHAPE, color: colors.accent }}
            />
          </Fragment>
        ))}

      {center && (
        <Marker
          position={[center.lat, center.lng]}
          icon={makePin(
            t(isTop ? "map.pinCenter" : "map.pinCandidate"),
            "pin--center",
            38,
          )}
        >
          <Popup>
            <b>{center.name}</b>
            <br />
            {t(isTop ? "map.centerBest" : "map.centerSelected")}
          </Popup>
        </Marker>
      )}

      {result && (
        <CircleMarker
          center={[result.centroid.lat, result.centroid.lng]}
          radius={5}
          pathOptions={{
            color: colors.accentSupport,
            fillColor: colors.accentSupport,
            fillOpacity: 0.6,
            weight: 1,
          }}
        >
          <Popup>{t("map.centroid")}</Popup>
        </CircleMarker>
      )}

      <FitBounds points={points} />
    </MapContainer>
  );
}
