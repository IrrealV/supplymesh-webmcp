import { latLngBounds, type LatLngBounds } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { ImageOverlay } from "react-leaflet";
import type { OperationalRisk, RiskKind } from "../../../domain/entities";
import "./weatherRiskOverlay.css";

const WEATHER_RISK_KINDS = ["heavy-rain", "severe-snow", "severe-storm", "calima"] as const;
const MID_VIEWBOX_EXTENT = 1000;
const CLOSE_VIEWBOX_EXTENT = 8000;

export type WeatherRiskKind = (typeof WEATHER_RISK_KINDS)[number];
export type WeatherZoomBand = "overview" | "mid" | "close";

type Coordinate = readonly [longitude: number, latitude: number];
type WeatherPalette = Readonly<{ background: string; foreground: string; outline: string }>;
type WeatherMarkup = Readonly<{ animationCss: string; body: string; definitions: string }>;

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

function normalizedPolygonPoints(ring: readonly Coordinate[], extent: number): string {
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
      const x = ((longitude - minimumLongitude) / longitudeSpan) * extent;
      const y = ((maximumLatitude - latitude) / latitudeSpan) * extent;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function rainMarkup(): string {
  return Array.from({ length: 28 }, (_, index) => {
    const x = (index * 83 + 17) % 1040 - 20;
    const y = (index * 149 + 31) % 1040 - 20;
    return `<line x1="${x}" y1="${y}" x2="${x - 18}" y2="${y + 38}" />`;
  }).join("");
}

function snowMarkup(): string {
  return Array.from({ length: 32 }, (_, index) => {
    const x = (index * 97 + 29) % 980 + 10;
    const y = (index * 173 + 11) % 980 + 10;
    const radius = 5 + (index % 3);
    return `<circle cx="${x}" cy="${y}" r="${radius}" />`;
  }).join("");
}

function stormMarkup(): string {
  return Array.from({ length: 18 }, (_, index) => {
    const y = (index * 59 + 38) % 920 + 40;
    const x = (index * 113 + 23) % 420;
    const width = 230 + (index % 3) * 45;
    return `<path d="M ${x} ${y} C ${x + width * 0.28} ${y - 24}, ${x + width * 0.72} ${y + 24}, ${x + width} ${y}" />`;
  }).join("");
}

function calimaMarkup(): string {
  return Array.from({ length: 6 }, (_, index) => {
    const y = 145 + index * 125;
    const opacity = (0.12 + (index % 3) * 0.07).toFixed(2);
    return `<path opacity="${opacity}" d="M -60 ${y} C 210 ${y - 90}, 390 ${y + 80}, 620 ${y - 10} S 940 ${y - 70}, 1080 ${y + 30} L 1080 ${y + 135} C 780 ${y + 55}, 520 ${y + 165}, 250 ${y + 90} S 40 ${y + 135}, -60 ${y + 80} Z" />`;
  }).join("");
}

function weatherPalette(kind: WeatherRiskKind): WeatherPalette {
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

function midWeatherMarkup(kind: WeatherRiskKind, palette: WeatherPalette, reducedMotion: boolean): WeatherMarkup {
  const animationCss = reducedMotion
    ? ""
    : `
      .rain-motion { animation: weather-rain 900ms linear infinite; }
      .snow-motion { animation: weather-snow 4.8s linear infinite; }
      .storm-motion { animation: weather-storm 1.45s ease-in-out infinite alternate; }
      .calima-motion { animation: weather-calima 5.8s ease-in-out infinite alternate; }
      @keyframes weather-rain { from { transform: translate(18px,-54px); } to { transform: translate(-18px,54px); } }
      @keyframes weather-snow { from { transform: translate(0,-28px); } to { transform: translate(22px,48px); } }
      @keyframes weather-storm { from { transform: translateX(-22px); opacity: .64; } to { transform: translateX(30px); opacity: 1; } }
      @keyframes weather-calima { from { transform: translateX(-28px) scale(1); } to { transform: translateX(28px) scale(1.04); } }
    `;

  if (kind === "heavy-rain") {
    return {
      animationCss,
      definitions: "",
      body: `<g class="weather-mid-phenomenon rain-motion" fill="none" stroke="${palette.foreground}" stroke-linecap="round" stroke-width="6">${rainMarkup()}</g>`,
    };
  }
  if (kind === "severe-snow") {
    return {
      animationCss,
      definitions: "",
      body: `<g class="weather-mid-phenomenon snow-motion" fill="${palette.foreground}">${snowMarkup()}</g>`,
    };
  }
  if (kind === "severe-storm") {
    return {
      animationCss,
      definitions: "",
      body: `<g class="weather-mid-phenomenon storm-motion" fill="none" stroke="${palette.foreground}" stroke-linecap="round" stroke-width="7">${stormMarkup()}</g>`,
    };
  }

  return {
    animationCss,
    definitions: `
      <radialGradient id="weather-haze" cx="50%" cy="50%" r="68%">
        <stop offset="0%" stop-color="${palette.foreground}" stop-opacity="0.42" />
        <stop offset="58%" stop-color="${palette.background}" stop-opacity="0.26" />
        <stop offset="100%" stop-color="${palette.background}" stop-opacity="0" />
      </radialGradient>
    `,
    body: `<rect width="${MID_VIEWBOX_EXTENT}" height="${MID_VIEWBOX_EXTENT}" fill="url(#weather-haze)" /><g class="weather-mid-phenomenon calima-motion" fill="${palette.foreground}">${calimaMarkup()}</g>`,
  };
}

function closeWeatherMarkup(kind: WeatherRiskKind, palette: WeatherPalette, reducedMotion: boolean): WeatherMarkup {
  const animationCss = reducedMotion
    ? ""
    : `
      .weather-close-rain { animation: weather-close-rain 760ms linear infinite; }
      .weather-close-snow { animation: weather-close-snow 4.8s linear infinite; }
      .weather-close-storm { animation: weather-close-storm 1.25s ease-in-out infinite alternate; }
      .weather-close-calima { animation: weather-close-calima 5.4s ease-in-out infinite alternate; }
      .weather-close-lightning { animation: weather-close-lightning 2.8s steps(1, end) infinite; }
      @keyframes weather-close-rain { from { transform: translate(0,-88px); } to { transform: translate(-24px,0); } }
      @keyframes weather-close-snow { from { transform: translate(0,-96px); } to { transform: translate(28px,0); } }
      @keyframes weather-close-storm { from { transform: translateX(-36px); opacity: .62; } to { transform: translateX(42px); opacity: 1; } }
      @keyframes weather-close-calima { from { transform: translateX(-44px); opacity: .58; } to { transform: translateX(44px); opacity: .86; } }
      @keyframes weather-close-lightning { 0%, 89%, 100% { opacity: 0; } 90%, 93% { opacity: .9; } }
    `;

  if (kind === "heavy-rain") {
    return {
      animationCss,
      definitions: `
        <pattern id="weather-rain-pattern" width="64" height="88" patternUnits="userSpaceOnUse" patternTransform="rotate(14)">
          <line x1="48" y1="-8" x2="28" y2="48" stroke="${palette.foreground}" stroke-width="4" stroke-linecap="round" />
          <line x1="12" y1="34" x2="-8" y2="90" stroke="${palette.foreground}" stroke-width="4" stroke-linecap="round" />
        </pattern>
      `,
      body: `<g class="weather-close-rain"><rect x="-160" y="-160" width="${CLOSE_VIEWBOX_EXTENT + 320}" height="${CLOSE_VIEWBOX_EXTENT + 320}" fill="url(#weather-rain-pattern)" /></g>`,
    };
  }
  if (kind === "severe-snow") {
    return {
      animationCss,
      definitions: `
        <pattern id="weather-snow-pattern" width="104" height="104" patternUnits="userSpaceOnUse">
          <circle cx="18" cy="22" r="4.5" fill="${palette.foreground}" />
          <circle cx="68" cy="34" r="6" fill="${palette.foreground}" />
          <circle cx="42" cy="82" r="3.5" fill="${palette.foreground}" />
          <circle cx="96" cy="88" r="4.5" fill="${palette.foreground}" />
        </pattern>
      `,
      body: `<g class="weather-close-snow"><rect x="-160" y="-160" width="${CLOSE_VIEWBOX_EXTENT + 320}" height="${CLOSE_VIEWBOX_EXTENT + 320}" fill="url(#weather-snow-pattern)" /></g>`,
    };
  }
  if (kind === "severe-storm") {
    const center = CLOSE_VIEWBOX_EXTENT / 2;
    return {
      animationCss,
      definitions: `
        <pattern id="weather-storm-pattern" width="280" height="150" patternUnits="userSpaceOnUse">
          <path d="M -30 38 C 48 10, 164 66, 310 34" fill="none" stroke="${palette.foreground}" stroke-width="6" stroke-linecap="round" />
          <path d="M 28 112 C 110 82, 205 132, 330 101" fill="none" stroke="${palette.foreground}" stroke-width="4" stroke-linecap="round" opacity="0.72" />
        </pattern>
      `,
      body: `<g class="weather-close-storm"><rect x="-320" y="-160" width="${CLOSE_VIEWBOX_EXTENT + 640}" height="${CLOSE_VIEWBOX_EXTENT + 320}" fill="url(#weather-storm-pattern)" /></g><path class="weather-close-lightning" d="M ${center + 110} ${center - 190} L ${center + 20} ${center + 15} L ${center + 92} ${center - 2} L ${center - 18} ${center + 212} L ${center + 198} ${center - 70} L ${center + 118} ${center - 48} Z" fill="#fde68a" />`,
    };
  }

  return {
    animationCss,
    definitions: `
      <linearGradient id="weather-calima-base" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.foreground}" stop-opacity="0.10" />
        <stop offset="48%" stop-color="${palette.background}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="${palette.foreground}" stop-opacity="0.09" />
      </linearGradient>
      <pattern id="weather-calima-pattern" width="420" height="220" patternUnits="userSpaceOnUse">
        <path d="M -90 112 C 40 40, 170 176, 520 82 L 520 178 C 210 236, 72 118, -90 205 Z" fill="${palette.foreground}" fill-opacity="0.12" />
      </pattern>
    `,
    body: `<rect width="${CLOSE_VIEWBOX_EXTENT}" height="${CLOSE_VIEWBOX_EXTENT}" fill="url(#weather-calima-base)" /><g class="weather-close-calima"><rect x="-420" y="-220" width="${CLOSE_VIEWBOX_EXTENT + 840}" height="${CLOSE_VIEWBOX_EXTENT + 440}" fill="url(#weather-calima-pattern)" /></g>`,
  };
}

export function createWeatherOverlaySvg(
  kind: WeatherRiskKind,
  ring: readonly Coordinate[],
  band: Exclude<WeatherZoomBand, "overview">,
  reducedMotion: boolean,
): string {
  const extent = band === "close" ? CLOSE_VIEWBOX_EXTENT : MID_VIEWBOX_EXTENT;
  const points = normalizedPolygonPoints(ring, extent);
  const palette = weatherPalette(kind);
  const markup = band === "close"
    ? closeWeatherMarkup(kind, palette, reducedMotion)
    : midWeatherMarkup(kind, palette, reducedMotion);
  const backgroundOpacity = band === "close" ? 0.09 : 0.12;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" preserveAspectRatio="none">
    <defs>
      <clipPath id="weather-zone"><polygon points="${points}" /></clipPath>
      ${markup.definitions}
      <style>${markup.animationCss}</style>
    </defs>
    <g clip-path="url(#weather-zone)">
      <rect width="${extent}" height="${extent}" fill="${palette.background}" fill-opacity="${backgroundOpacity}" />
      ${markup.body}
    </g>
    <polygon points="${points}" fill="none" stroke="${palette.outline}" stroke-opacity="0.78" stroke-width="4" vector-effect="non-scaling-stroke" />
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
      opacity={band === "close" ? 0.82 : 0.72}
      pane="weather-effects"
      url={source}
    />
  );
}
