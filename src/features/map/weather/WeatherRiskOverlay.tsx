import { latLngBounds, type LatLngBounds } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import type { OperationalRisk, RiskKind } from "../../../domain/entities";
import "./weatherRiskOverlay.css";

const WEATHER_RISK_KINDS = ["heavy-rain", "severe-snow", "severe-storm", "calima"] as const;

export type WeatherRiskKind = (typeof WEATHER_RISK_KINDS)[number];
export type WeatherZoomBand = "overview" | "mid" | "close";

type Coordinate = readonly [longitude: number, latitude: number];

export function isWeatherRiskKind(kind: RiskKind): kind is WeatherRiskKind {
  return WEATHER_RISK_KINDS.includes(kind as WeatherRiskKind);
}

export function weatherZoomBand(zoom: number): WeatherZoomBand {
  if (!Number.isFinite(zoom) || zoom < 8) return "overview";
  return zoom < 14 ? "mid" : "close";
}

function weatherRiskRing(risk: OperationalRisk): Coordinate[] {
  const geometry = risk.geometry.geometry;
  if (geometry.type === "Polygon") {
    return geometry.coordinates[0].map(([longitude, latitude]) => [longitude, latitude]);
  }

  const coordinates = geometry.coordinates.map(([longitude, latitude]) => [longitude, latitude] as Coordinate);
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const longitudePadding = Math.max((maximumLongitude - minimumLongitude) * 0.12, 0.02);
  const latitudePadding = Math.max((maximumLatitude - minimumLatitude) * 0.12, 0.02);

  return [
    [minimumLongitude - longitudePadding, minimumLatitude - latitudePadding],
    [maximumLongitude + longitudePadding, minimumLatitude - latitudePadding],
    [maximumLongitude + longitudePadding, maximumLatitude + latitudePadding],
    [minimumLongitude - longitudePadding, maximumLatitude + latitudePadding],
    [minimumLongitude - longitudePadding, minimumLatitude - latitudePadding],
  ];
}

export function weatherRiskBounds(risk: OperationalRisk): LatLngBounds {
  const ring = weatherRiskRing(risk);
  if (ring.length < 3) throw new TypeError(`Weather risk ${risk.id} has no usable geographic extent.`);
  return latLngBounds(ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]));
}

function normalizedPolygonPoints(ring: readonly Coordinate[]): string {
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const longitudeSpan = Math.max(maximumLongitude - minimumLongitude, Number.EPSILON);
  const latitudeSpan = Math.max(maximumLatitude - minimumLatitude, Number.EPSILON);

  return ring
    .map(([longitude, latitude]) => {
      const x = ((longitude - minimumLongitude) / longitudeSpan) * 1000;
      const y = ((maximumLatitude - latitude) / latitudeSpan) * 1000;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function rainMarkup(band: WeatherZoomBand): string {
  const count = band === "close" ? 56 : 28;
  return Array.from({ length: count }, (_, index) => {
    const x = (index * 83 + 17) % 1040 - 20;
    const y = (index * 149 + 31) % 1040 - 20;
    const length = band === "close" ? 54 : 38;
    return `<line x1="${x}" y1="${y}" x2="${x - 18}" y2="${y + length}" />`;
  }).join("");
}

function snowMarkup(band: WeatherZoomBand): string {
  const count = band === "close" ? 66 : 32;
  return Array.from({ length: count }, (_, index) => {
    const x = (index * 97 + 29) % 980 + 10;
    const y = (index * 173 + 11) % 980 + 10;
    const radius = band === "close" ? 7 + (index % 4) : 5 + (index % 3);
    return `<circle cx="${x}" cy="${y}" r="${radius}" />`;
  }).join("");
}

function stormMarkup(band: WeatherZoomBand): string {
  const count = band === "close" ? 34 : 18;
  const gusts = Array.from({ length: count }, (_, index) => {
    const y = (index * 59 + 38) % 920 + 40;
    const x = (index * 113 + 23) % 420;
    const width = band === "close" ? 320 + (index % 4) * 55 : 230 + (index % 3) * 45;
    return `<path d="M ${x} ${y} C ${x + width * 0.28} ${y - 24}, ${x + width * 0.72} ${y + 24}, ${x + width} ${y}" />`;
  }).join("");
  const lightning = band === "close"
    ? '<path class="weather-lightning" d="M 610 120 L 520 475 L 650 440 L 545 850 L 810 355 L 670 390 Z" />'
    : "";
  return `${gusts}${lightning}`;
}

function calimaMarkup(band: WeatherZoomBand): string {
  const bands = band === "close" ? 9 : 6;
  return Array.from({ length: bands }, (_, index) => {
    const y = 145 + index * (band === "close" ? 88 : 125);
    const opacity = (0.12 + (index % 3) * 0.07).toFixed(2);
    return `<path opacity="${opacity}" d="M -60 ${y} C 210 ${y - 90}, 390 ${y + 80}, 620 ${y - 10} S 940 ${y - 70}, 1080 ${y + 30} L 1080 ${y + 135} C 780 ${y + 55}, 520 ${y + 165}, 250 ${y + 90} S 40 ${y + 135}, -60 ${y + 80} Z" />`;
  }).join("");
}

function weatherPalette(kind: WeatherRiskKind): { background: string; foreground: string; outline: string } {
  switch (kind) {
    case "heavy-rain":
      return { background: "#1d4ed8", foreground: "#bfdbfe", outline: "#2563eb" };
    case "severe-snow":
      return { background: "#7dd3fc", foreground: "#ffffff", outline: "#0284c7" };
    case "severe-storm":
      return { background: "#334155", foreground: "#93c5fd", outline: "#475569" };
    case "calima":
      return { background: "#d97706", foreground: "#fbbf24", outline: "#b45309" };
  }
}

export function createWeatherOverlaySvg(
  kind: WeatherRiskKind,
  ring: readonly Coordinate[],
  band: Exclude<WeatherZoomBand, "overview">,
  reducedMotion: boolean,
): string {
  const points = normalizedPolygonPoints(ring);
  const palette = weatherPalette(kind);
  const backgroundOpacity = band === "close" ? 0.24 : 0.14;
  const animationCss = reducedMotion
    ? ""
    : `
      .rain-motion { animation: weather-rain 900ms linear infinite; }
      .snow-motion { animation: weather-snow 4.8s linear infinite; }
      .storm-motion { animation: weather-storm 1.45s ease-in-out infinite alternate; }
      .calima-motion { animation: weather-calima 5.8s ease-in-out infinite alternate; }
      .weather-lightning { animation: weather-lightning 2.6s steps(1, end) infinite; }
      @keyframes weather-rain { from { transform: translate(18px,-54px); } to { transform: translate(-18px,54px); } }
      @keyframes weather-snow { from { transform: translate(0,-28px); } to { transform: translate(22px,48px); } }
      @keyframes weather-storm { from { transform: translateX(-22px); opacity: .64; } to { transform: translateX(30px); opacity: 1; } }
      @keyframes weather-calima { from { transform: translateX(-28px) scale(1); } to { transform: translateX(28px) scale(1.04); } }
      @keyframes weather-lightning { 0%, 87%, 100% { opacity: 0; } 88%, 91% { opacity: .95; } }
    `;

  let phenomenon = "";
  let groupClass = "";
  if (kind === "heavy-rain") {
    groupClass = "rain-motion";
    phenomenon = rainMarkup(band);
  } else if (kind === "severe-snow") {
    groupClass = "snow-motion";
    phenomenon = snowMarkup(band);
  } else if (kind === "severe-storm") {
    groupClass = "storm-motion";
    phenomenon = stormMarkup(band);
  } else {
    groupClass = "calima-motion";
    phenomenon = calimaMarkup(band);
  }

  const strokeWidth = band === "close" ? 7 : 5;
  const particleWidth = kind === "heavy-rain" ? (band === "close" ? 8 : 6) : kind === "severe-storm" ? (band === "close" ? 10 : 7) : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
    <defs>
      <clipPath id="weather-zone"><polygon points="${points}" /></clipPath>
      <radialGradient id="weather-haze" cx="50%" cy="50%" r="68%">
        <stop offset="0%" stop-color="${palette.foreground}" stop-opacity="0.48" />
        <stop offset="58%" stop-color="${palette.background}" stop-opacity="0.30" />
        <stop offset="100%" stop-color="${palette.background}" stop-opacity="0" />
      </radialGradient>
      <style>
        .phenomenon { fill: ${palette.foreground}; stroke: ${palette.foreground}; stroke-linecap: round; stroke-linejoin: round; stroke-width: ${particleWidth}; }
        .weather-lightning { fill: #fde68a; stroke: none; }
        ${animationCss}
      </style>
    </defs>
    <g clip-path="url(#weather-zone)">
      <rect width="1000" height="1000" fill="${palette.background}" fill-opacity="${backgroundOpacity}" />
      ${kind === "calima" ? '<rect width="1000" height="1000" fill="url(#weather-haze)" />' : ""}
      <g class="phenomenon ${groupClass}">${phenomenon}</g>
    </g>
    <polygon points="${points}" fill="none" stroke="${palette.outline}" stroke-opacity="0.78" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />
  </svg>`;
}

export function createWeatherOverlayDataUrl(
  kind: WeatherRiskKind,
  ring: readonly Coordinate[],
  band: Exclude<WeatherZoomBand, "overview">,
  reducedMotion: boolean,
): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(createWeatherOverlaySvg(kind, ring, band, reducedMotion))}`;
}

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches === true);

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (media === undefined) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener?.("change", update);
    update();
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}

export function WeatherRiskOverlay({ risk, zoom }: { risk: OperationalRisk; zoom: number }) {
  const reducedMotion = useReducedMotion();
  const kind = isWeatherRiskKind(risk.kind) ? risk.kind : null;
  const band = weatherZoomBand(zoom);
  const ring = useMemo(() => kind === null ? [] : weatherRiskRing(risk), [kind, risk]);
  const bounds = useMemo(() => kind === null ? null : weatherRiskBounds(risk), [kind, risk]);
  const source = useMemo(
    () => kind === null || band === "overview" ? "" : createWeatherOverlayDataUrl(kind, ring, band, reducedMotion),
    [band, kind, reducedMotion, ring],
  );

  if (kind === null || band === "overview" || bounds === null) return null;

  return (
    <ImageOverlay
      alt=""
      bounds={bounds}
      className={`weather-geographic-overlay weather-geographic-${kind} weather-geographic-${band}`}
      interactive={false}
      opacity={band === "close" ? 0.96 : 0.72}
      pane="weather-effects"
      url={source}
    />
  );
}
