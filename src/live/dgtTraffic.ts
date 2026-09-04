import type { OperatingRegion, Route } from "../domain/entities";
import type { LiveConditionSeverity, LiveTrafficCategory, LiveTrafficIncident } from "./liveConditions";

export type DgtTrafficResult = Readonly<{
  incidents: readonly LiveTrafficIncident[];
  nationalIncidentCount: number;
  feedPublishedAt: string | null;
}>;

type ParsedIncident = Readonly<{
  id: string;
  coordinates: readonly [longitude: number, latitude: number];
  category: LiveTrafficCategory;
  severity: LiveConditionSeverity;
  title: string;
  roadName: string | null;
  province: string | null;
  municipality: string | null;
  cause: string | null;
  managementType: string | null;
  updatedAt: string | null;
}>;

type RouteSample = Readonly<{
  routeId: string;
  vehicleId: string;
  coordinates: readonly [longitude: number, latitude: number];
}>;

const MAX_RELEVANT_INCIDENTS = 40;
const ROUTE_RELEVANCE_KM = 15;

function localElements(parent: ParentNode, localName: string): Element[] {
  if ("getElementsByTagNameNS" in parent) {
    const nodes = (parent as Document | Element).getElementsByTagNameNS("*", localName);
    if (nodes.length > 0) return Array.from(nodes);
  }
  if ("querySelectorAll" in parent) return Array.from(parent.querySelectorAll(localName));
  return [];
}

function firstText(parent: ParentNode, names: readonly string[]): string | null {
  for (const name of names) {
    const value = localElements(parent, name)[0]?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

function numberText(parent: ParentNode, names: readonly string[]): number | null {
  const value = firstText(parent, names);
  if (value === null) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function recordType(record: Element): string {
  const xsi = record.getAttributeNS("http://www.w3.org/2001/XMLSchema-instance", "type")
    ?? record.getAttribute("xsi:type")
    ?? record.getAttribute("type")
    ?? record.localName;
  return xsi.split(":").at(-1) ?? xsi;
}

function category(type: string, cause: string | null, management: string | null): LiveTrafficCategory {
  const value = `${type} ${cause ?? ""} ${management ?? ""}`.toLowerCase();
  if (value.includes("accident")) return "accident";
  if (value.includes("abnormaltraffic") || value.includes("congestion") || value.includes("queue")) return "congestion";
  if (value.includes("closure") || value.includes("closed") || value.includes("roadblock") || value.includes("carriagewayorlane")) return "closure";
  if (value.includes("construction") || value.includes("maintenance") || value.includes("roadworks") || value.includes("works")) return "works";
  if (value.includes("vehicle") || value.includes("breakdown")) return "vehicle";
  if (value.includes("weather") || value.includes("environment")) return "weather";
  if (value.includes("obstruction") || value.includes("animal") || value.includes("debris")) return "obstruction";
  return "other";
}

function severity(value: string | null, incidentCategory: LiveTrafficCategory): LiveConditionSeverity {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("highest") || normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "warning";
  if (normalized.includes("medium")) return "advisory";
  if (["accident", "closure", "vehicle"].includes(incidentCategory)) return "warning";
  if (["congestion", "works", "weather", "obstruction"].includes(incidentCategory)) return "advisory";
  return "normal";
}

function humanTitle(incidentCategory: LiveTrafficCategory, type: string, roadName: string | null): string {
  const labels: Record<LiveTrafficCategory, string> = {
    accident: "Traffic accident",
    congestion: "Congestion",
    closure: "Road or lane restriction",
    works: "Road works",
    vehicle: "Stopped or disabled vehicle",
    weather: "Weather-related road condition",
    obstruction: "Road obstruction",
    other: type.replace(/([a-z])([A-Z])/g, "$1 $2") || "Traffic incident",
  };
  return `${labels[incidentCategory]}${roadName ? ` · ${roadName}` : ""}`;
}

export function parseDgtDatex2(xml: string): Readonly<{ incidents: readonly ParsedIncident[]; feedPublishedAt: string | null }> {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("DGT returned invalid DATEX II XML.");

  const feedPublishedAt = firstText(document, ["publicationTime", "publicationCreationTime"]);
  const parsed: ParsedIncident[] = [];
  const situations = localElements(document, "situation");

  for (const situation of situations) {
    const situationId = situation.getAttribute("id") ?? situation.getAttribute("gml:id") ?? `situation-${parsed.length + 1}`;
    const overallSeverity = firstText(situation, ["overallSeverity"]);
    const records = localElements(situation, "situationRecord");

    for (const [recordIndex, record] of records.entries()) {
      const latitude = numberText(record, ["latitude"]);
      const longitude = numberText(record, ["longitude"]);
      if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;

      const type = recordType(record);
      const roadName = firstText(record, ["roadName", "roadNumber", "roadIdentifier"]);
      const cause = firstText(record, ["causeType", "causeDescription"]);
      const managementType = firstText(record, ["roadOrCarriagewayOrLaneManagementType", "trafficManagementType"]);
      const incidentCategory = category(type, cause, managementType);
      const recordId = record.getAttribute("id") ?? record.getAttribute("gml:id") ?? String(recordIndex + 1);

      parsed.push({
        id: `${situationId}:${recordId}`,
        coordinates: [longitude, latitude],
        category: incidentCategory,
        severity: severity(firstText(record, ["severity"]) ?? overallSeverity, incidentCategory),
        title: humanTitle(incidentCategory, type, roadName),
        roadName,
        province: firstText(record, ["province"]),
        municipality: firstText(record, ["municipality"]),
        cause,
        managementType,
        updatedAt: firstText(record, ["situationRecordVersionTime", "overallStartTime", "situationRecordCreationTime"]),
      });
    }
  }

  return { incidents: parsed, feedPublishedAt };
}

function haversineKm(left: readonly [number, number], right: readonly [number, number]): number {
  const radius = 6371;
  const latitude1 = left[1] * Math.PI / 180;
  const latitude2 = right[1] * Math.PI / 180;
  const deltaLatitude = (right[1] - left[1]) * Math.PI / 180;
  const deltaLongitude = (right[0] - left[0]) * Math.PI / 180;
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeSamples(routes: readonly Route[]): RouteSample[] {
  return routes.flatMap((route) => {
    const coordinates = route.geometry.geometry.coordinates;
    const step = Math.max(1, Math.floor(coordinates.length / 120));
    const sampled = coordinates.filter((_, index) => index % step === 0 || index === coordinates.length - 1);
    return sampled.map(([longitude, latitude]) => ({
      routeId: route.id,
      vehicleId: route.vehicleId,
      coordinates: [longitude, latitude] as const,
    }));
  });
}

function relevantIncident(incident: ParsedIncident, samples: readonly RouteSample[]): LiveTrafficIncident | null {
  let nearest: RouteSample | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const candidateDistance = haversineKm(incident.coordinates, sample.coordinates);
    if (candidateDistance >= distance) continue;
    nearest = sample;
    distance = candidateDistance;
  }
  if (nearest === undefined || distance > ROUTE_RELEVANCE_KM) return null;
  return {
    ...incident,
    nearestRouteId: nearest.routeId,
    affectedVehicleId: nearest.vehicleId || null,
    distanceToRouteKm: Math.round(distance * 10) / 10,
  };
}

const severityRank: Record<LiveConditionSeverity, number> = { normal: 0, advisory: 1, warning: 2, critical: 3 };

export async function fetchDgtTraffic(
  scenario: OperatingRegion,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<DgtTrafficResult> {
  const response = await fetchImpl("/api/live-traffic", { headers: { accept: "application/xml,text/xml;q=0.9" }, signal });
  if (!response.ok) throw new Error(`DGT live traffic returned HTTP ${response.status}.`);
  const xml = await response.text();
  const parsed = parseDgtDatex2(xml);
  const samples = routeSamples(scenario.routes);
  const incidents = parsed.incidents
    .map((incident) => relevantIncident(incident, samples))
    .filter((incident): incident is LiveTrafficIncident => incident !== null)
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity] || left.distanceToRouteKm - right.distanceToRouteKm)
    .slice(0, MAX_RELEVANT_INCIDENTS);

  return {
    incidents,
    nationalIncidentCount: parsed.incidents.length,
    feedPublishedAt: parsed.feedPublishedAt,
  };
}
