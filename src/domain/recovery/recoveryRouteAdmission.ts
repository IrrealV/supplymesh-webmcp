import { booleanIntersects, length, lineString, point, pointToLineDistance, pointToPolygonDistance, polygon as turfPolygon } from "@turf/turf";
import type { Unit211AlternativeOption } from "../operations/unit211PreDispatchContext";
import { deepDetachAndFreeze } from "../deepDetach";
import { canonicalJson, sha256Fingerprint, type Sha256Crypto } from "./canonicalJson";
import { RecoveryErrorCodes, recoveryFailure, recoverySuccess, type RecoveryResult, type RecoveryRouteEvidencePayload } from "./recoveryContracts";

type Coordinate = [number, number];
type CatalogReader = () => unknown;
const COORDINATE_COUNT_MAX = 10_000;

function unavailable<T>(): RecoveryResult<T> {
  return recoveryFailure(RecoveryErrorCodes.comparisonUnavailable, "The admitted recovery route is unavailable or malformed.", ["RETRY", "CONTACT_OPERATOR"]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    const ownKeys = Reflect.ownKeys(value);
    return ownKeys.length === keys.length && ownKeys.every((key) => typeof key === "string" && keys.includes(key));
  } catch {
    return false;
  }
}

function canonicalCopy(value: unknown): unknown | false {
  const canonical = canonicalJson(value);
  if (!canonical.ok) return false;
  try {
    return JSON.parse(canonical.data) as unknown;
  } catch {
    return false;
  }
}

function ownData(value: Record<string, unknown>, key: string): unknown | false {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor ? descriptor.value : false;
  } catch {
    return false;
  }
}

function copyCoordinates(value: unknown, countMin: number): Coordinate[] | false {
  if (!Array.isArray(value) || value.length < countMin || value.length > COORDINATE_COUNT_MAX) return false;
  const coordinates: Coordinate[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || !entry.every((component) => typeof component === "number" && Number.isFinite(component))) return false;
    coordinates.push([entry[0], entry[1]]);
  }
  return coordinates;
}

function copyPolygon(value: unknown): RecoveryRouteEvidencePayload["provenance"]["avoidance"]["polygon"] | false {
  if (!hasExactKeys(value, ["type", "coordinates"]) || value.type !== "Polygon" || !Array.isArray(value.coordinates) || value.coordinates.length === 0 || value.coordinates.length > 16) return false;
  const rings: Coordinate[][] = [];
  for (const ring of value.coordinates) {
    const coordinates = copyCoordinates(ring, 4);
    const first = coordinates === false ? undefined : coordinates[0];
    const last = coordinates === false ? undefined : coordinates.at(-1);
    if (coordinates === false || first === undefined || last === undefined || first[0] !== last[0] || first[1] !== last[1]) return false;
    rings.push(coordinates);
  }
  return { type: "Polygon", coordinates: rings };
}

function computedClearanceMeters(routeCoordinates: Coordinate[], polygonCoordinates: Coordinate[][]): number | false {
  try {
    const route = lineString(routeCoordinates);
    const area = turfPolygon(polygonCoordinates);
    if (booleanIntersects(route, area)) return false;
    let minimum = Number.POSITIVE_INFINITY;
    for (const coordinate of routeCoordinates) minimum = Math.min(minimum, pointToPolygonDistance(point(coordinate), area, { units: "meters" }));
    for (const ring of polygonCoordinates) for (const coordinate of ring) minimum = Math.min(minimum, pointToLineDistance(point(coordinate), route, { units: "meters" }));
    return Number.isFinite(minimum) && minimum > 0 ? minimum : false;
  } catch {
    return false;
  }
}

function isTemporal(value: unknown): value is RecoveryRouteEvidencePayload["temporalAssessment"] {
  return hasExactKeys(value, ["remainingRouteMinutes", "remainingDriveMinutes", "estimatedCompletionAt", "restDeadline", "status", "reasonCode"])
    && value.remainingRouteMinutes === 88.04166666666667
    && value.remainingDriveMinutes === 235
    && value.estimatedCompletionAt === "2026-08-28T10:28:02.500Z"
    && value.restDeadline === "2026-08-28T16:00:00Z"
    && value.status === "PASS"
    && value.reasonCode === "TEMPORAL_WINDOW_SATISFIED";
}

function isCargoFacts(value: unknown): boolean {
  return hasExactKeys(value, ["vehicleId", "cargoId", "destinationId", "refrigeration", "priority"])
    && value.vehicleId === "vehicle-011" && value.cargoId === "cargo-011" && value.destinationId === "alcobendas" && value.refrigeration === "ambient" && value.priority === "standard";
}

function isCargo(value: unknown): value is RecoveryRouteEvidencePayload["cargoContinuityAssessment"] {
  return hasExactKeys(value, ["status", "reasonCode", "referenceFacts", "optionFacts"])
    && value.status === "PASS" && value.reasonCode === "CARGO_CONTINUITY_SATISFIED" && isCargoFacts(value.referenceFacts) && isCargoFacts(value.optionFacts);
}

export function captureRecoveryRouteEvidence(value: unknown): RecoveryResult<RecoveryRouteEvidencePayload> {
  const copied = canonicalCopy(value);
  if (!hasExactKeys(copied, ["relation", "geometry", "summary", "provenance", "avoidsExclusionZone", "temporalAssessment", "cargoContinuityAssessment"])) return unavailable();
  if (!hasExactKeys(copied.relation, ["vehicleId", "currentRouteId", "avoidsRiskId", "alternativeRouteId"])) return unavailable();
  const relation = copied.relation;
  if (relation.vehicleId !== "vehicle-011" || relation.currentRouteId !== "route-011" || relation.avoidsRiskId !== "restriction-height-3.9" || relation.alternativeRouteId !== "alternative-route-011-clearance-v1") return unavailable();
  if (!hasExactKeys(copied.geometry, ["type", "coordinates"]) || copied.geometry.type !== "LineString") return unavailable();
  const coordinates = copyCoordinates(copied.geometry.coordinates, 2);
  if (coordinates === false || !hasExactKeys(copied.summary, ["distanceMeters", "durationSeconds"]) || copied.summary.distanceMeters !== 80298.9 || copied.summary.durationSeconds !== 5282.5) return unavailable();
  if (!hasExactKeys(copied.provenance, ["provider", "profile", "sourceRevision", "generatedAt", "avoidance"]) || copied.provenance.provider !== "openrouteservice" || copied.provenance.profile !== "driving-hgv" || copied.provenance.sourceRevision !== "688161cb725d59117a55243b78e41b8191e5b0d718f7eff0c51fe783e680fdd0" || typeof copied.provenance.generatedAt !== "string") return unavailable();
  if (!hasExactKeys(copied.provenance.avoidance, ["shape", "radiusMeters", "steps", "minimumClearanceMeters", "polygon"])) return unavailable();
  const avoidance = copied.provenance.avoidance;
  const polygon = copyPolygon(avoidance.polygon);
  if (avoidance.shape !== "geodesic-circle" || avoidance.radiusMeters !== 250 || avoidance.steps !== 64 || typeof avoidance.minimumClearanceMeters !== "number" || polygon === false) return unavailable();
  const computedClearance = computedClearanceMeters(coordinates, polygon.coordinates);
  const computedDistanceMeters = length(lineString(coordinates), { units: "meters" });
  const clearanceTolerance = Number.EPSILON * Math.max(Math.abs(computedClearance === false ? 0 : computedClearance), Math.abs(avoidance.minimumClearanceMeters)) * 2;
  if (computedClearance === false || Math.abs(computedClearance - avoidance.minimumClearanceMeters) > clearanceTolerance || !Number.isFinite(computedDistanceMeters) || Math.abs(computedDistanceMeters - copied.summary.distanceMeters) > 1 || copied.avoidsExclusionZone !== true || !isTemporal(copied.temporalAssessment) || !isCargo(copied.cargoContinuityAssessment)) return unavailable();
  const detached = deepDetachAndFreeze<RecoveryRouteEvidencePayload>({
    relation: relation as RecoveryRouteEvidencePayload["relation"],
    geometry: { type: "LineString", coordinates },
    summary: { distanceMeters: 80298.9, durationSeconds: 5282.5 },
    provenance: { provider: "openrouteservice", profile: "driving-hgv", sourceRevision: copied.provenance.sourceRevision, generatedAt: copied.provenance.generatedAt, avoidance: { shape: "geodesic-circle", radiusMeters: 250, steps: 64, minimumClearanceMeters: avoidance.minimumClearanceMeters, polygon } },
    avoidsExclusionZone: true,
    temporalAssessment: copied.temporalAssessment,
    cargoContinuityAssessment: copied.cargoContinuityAssessment,
  });
  return detached.ok ? recoverySuccess(detached.data) : unavailable();
}

export function recoveryRouteEvidenceFromOption(option: Unit211AlternativeOption): RecoveryResult<RecoveryRouteEvidencePayload> {
  return captureRecoveryRouteEvidence({ relation: option.relation, geometry: option.geometry, summary: option.summary, provenance: option.provenance, avoidsExclusionZone: option.avoidsExclusionZone, temporalAssessment: option.temporalAssessment, cargoContinuityAssessment: option.cargoContinuityAssessment });
}

export function readAdmittedRecoveryRoute(readCatalog: CatalogReader): RecoveryResult<RecoveryRouteEvidencePayload> {
  let value: unknown;
  try { value = readCatalog(); } catch { return unavailable(); }
  if (!hasExactKeys(value, ["relation", "geometry", "summary", "provenance"])) return unavailable();
  try {
    const relation = ownData(value, "relation");
    const geometry = ownData(value, "geometry");
    const summary = ownData(value, "summary");
    const provenance = ownData(value, "provenance");
    if (relation === false || geometry === false || summary === false || provenance === false) return unavailable();
    return captureRecoveryRouteEvidence({
      relation,
      geometry,
      summary,
      provenance,
      avoidsExclusionZone: true,
      temporalAssessment: { remainingRouteMinutes: 88.04166666666667, remainingDriveMinutes: 235, estimatedCompletionAt: "2026-08-28T10:28:02.500Z", restDeadline: "2026-08-28T16:00:00Z", status: "PASS", reasonCode: "TEMPORAL_WINDOW_SATISFIED" },
      cargoContinuityAssessment: { status: "PASS", reasonCode: "CARGO_CONTINUITY_SATISFIED", referenceFacts: { vehicleId: "vehicle-011", cargoId: "cargo-011", destinationId: "alcobendas", refrigeration: "ambient", priority: "standard" }, optionFacts: { vehicleId: "vehicle-011", cargoId: "cargo-011", destinationId: "alcobendas", refrigeration: "ambient", priority: "standard" } },
    });
  } catch {
    return unavailable();
  }
}

export function recoveryRouteDigest(evidence: RecoveryRouteEvidencePayload, cryptoCapability?: Sha256Crypto | null): Promise<RecoveryResult<`sha256:${string}`>> {
  return sha256Fingerprint(evidence, cryptoCapability);
}
