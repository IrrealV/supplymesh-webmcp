import type { LiveTrafficEvent, LiveTrafficSeverity } from "./liveConditions";

const DGT_TRAFFIC_PROXY = "/api/live-traffic";
const SPAIN_BOUNDS = { minLatitude: 35, maxLatitude: 44.5, minLongitude: -10, maxLongitude: 5 } as const;

function descendants(node: Element): Element[] {
  return Array.from(node.getElementsByTagName("*"));
}

function firstText(node: Element, localNames: readonly string[]): string {
  const match = descendants(node).find((element) => localNames.includes(element.localName));
  return match?.textContent?.trim() ?? "";
}

function allText(node: Element, localName: string): string[] {
  return descendants(node)
    .filter((element) => element.localName === localName)
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);
}

function finiteCoordinate(value: string): number | undefined {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inSpain(latitude: number, longitude: number): boolean {
  return latitude >= SPAIN_BOUNDS.minLatitude && latitude <= SPAIN_BOUNDS.maxLatitude
    && longitude >= SPAIN_BOUNDS.minLongitude && longitude <= SPAIN_BOUNDS.maxLongitude;
}

function humanize(value: string): string {
  return value
    .replace(/^.*:/, "")
    .replace(/Record$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function severityFromRecord(record: Element, eventType: string): LiveTrafficSeverity {
  const explicit = firstText(record, ["severity", "trafficStatusValue"]).toLowerCase();
  const combined = `${explicit} ${eventType}`.toLowerCase();
  if (/highest|critical|blocked|closure|accident|wrong way|vehicle obstruction/.test(combined)) return "critical";
  if (/high|severe|major|stationary traffic|roadworks/.test(combined)) return "high";
  if (/medium|heavy traffic|slow traffic|weather/.test(combined)) return "medium";
  return "low";
}

function bestDescription(record: Element, eventType: string): string {
  const comments = allText(record, "value").filter((value) => value.length >= 8 && value.length <= 280);
  const comment = comments.find((value) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value));
  return comment ?? humanize(eventType);
}

function recordType(record: Element): string {
  const typed = Array.from(record.attributes).find((attribute) => attribute.localName === "type")?.value ?? record.localName;
  return typed || "trafficEvent";
}

function parseRecord(record: Element, index: number): LiveTrafficEvent | undefined {
  const latitude = finiteCoordinate(firstText(record, ["latitude"]));
  const longitude = finiteCoordinate(firstText(record, ["longitude"]));
  if (latitude === undefined || longitude === undefined || !inSpain(latitude, longitude)) return undefined;

  const eventTypeRaw = recordType(record);
  const eventType = humanize(eventTypeRaw);
  const id = record.getAttribute("id") ?? record.getAttribute("gml:id") ?? `dgt-${index}-${latitude}-${longitude}`;
  const updatedAt = firstText(record, ["situationRecordVersionTime", "situationRecordObservationTime", "situationRecordCreationTime"]);
  return {
    description: bestDescription(record, eventTypeRaw),
    direction: firstText(record, ["directionRelativeAtOrigin", "directionAtOrigin", "directionBoundOnLinearSection"]),
    eventType,
    id,
    latitude,
    longitude,
    road: firstText(record, ["roadNumber", "roadName", "roadIdentifier"]),
    severity: severityFromRecord(record, eventTypeRaw),
    updatedAt: Number.isNaN(Date.parse(updatedAt)) ? new Date(0).toISOString() : updatedAt,
    validFrom: firstText(record, ["overallStartTime"]) || undefined,
    validTo: firstText(record, ["overallEndTime"]) || undefined,
  };
}

export function parseDgtSituationPublication(xml: string): readonly LiveTrafficEvent[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("DGT returned malformed DATEX II XML.");

  const records = Array.from(document.getElementsByTagName("*")).filter((element) => element.localName === "situationRecord");
  const events = records.flatMap((record, index) => {
    const parsed = parseRecord(record, index);
    return parsed === undefined ? [] : [parsed];
  });

  const severityRank: Record<LiveTrafficSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return events
    .sort((left, right) => severityRank[right.severity] - severityRank[left.severity] || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 300);
}

export async function fetchLiveTraffic(signal: AbortSignal): Promise<readonly LiveTrafficEvent[]> {
  const response = await fetch(DGT_TRAFFIC_PROXY, { headers: { Accept: "application/xml,text/xml" }, signal });
  if (!response.ok) throw new Error(`DGT traffic proxy returned HTTP ${response.status}.`);
  return parseDgtSituationPublication(await response.text());
}
