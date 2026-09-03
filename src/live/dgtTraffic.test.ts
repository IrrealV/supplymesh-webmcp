import { describe, expect, it, vi } from "vitest";
import { createSpainScenario } from "../scenario/fixtures/spain-v1";
import { fetchDgtTraffic, parseDgtDatex2 } from "./dgtTraffic";

function xmlAt(longitude: number, latitude: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <d2:payload xmlns:d2="http://levelC/schema/3/d2Payload" xmlns:sit="http://levelC/schema/3/situation" xmlns:loc="http://levelC/schema/3/locationReferencing" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <d2:publicationTime>2026-09-03T20:05:00Z</d2:publicationTime>
    <sit:situation id="near-route">
      <sit:overallSeverity>high</sit:overallSeverity>
      <sit:situationRecord id="record-1" xsi:type="sit:Accident">
        <loc:roadName>A-1</loc:roadName>
        <sit:situationRecordVersionTime>2026-09-03T20:04:00Z</sit:situationRecordVersionTime>
        <sit:locationReference><loc:point><loc:pointCoordinates><loc:latitude>${latitude}</loc:latitude><loc:longitude>${longitude}</loc:longitude></loc:pointCoordinates></loc:point></sit:locationReference>
      </sit:situationRecord>
    </sit:situation>
    <sit:situation id="far-away">
      <sit:overallSeverity>medium</sit:overallSeverity>
      <sit:situationRecord id="record-2" xsi:type="sit:ConstructionWorks">
        <loc:roadName>TF-1</loc:roadName>
        <sit:locationReference><loc:point><loc:pointCoordinates><loc:latitude>28.30</loc:latitude><loc:longitude>-16.55</loc:longitude></loc:pointCoordinates></loc:point></sit:locationReference>
      </sit:situationRecord>
    </sit:situation>
  </d2:payload>`;
}

describe("DGT DATEX II live traffic", () => {
  it("parses namespaced incidents and maps only route-relevant events", async () => {
    const scenario = createSpainScenario();
    const [longitude, latitude] = scenario.routes[0].geometry.geometry.coordinates[0];
    const xml = xmlAt(longitude, latitude);
    const parsed = parseDgtDatex2(xml);

    expect(parsed.feedPublishedAt).toBe("2026-09-03T20:05:00Z");
    expect(parsed.incidents).toHaveLength(2);
    expect(parsed.incidents[0]).toMatchObject({ category: "accident", severity: "warning", roadName: "A-1" });

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(xml, { status: 200, headers: { "content-type": "application/xml" } }));
    const result = await fetchDgtTraffic(scenario, fetchImpl, new AbortController().signal);

    expect(result.nationalIncidentCount).toBe(2);
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0]).toMatchObject({ nearestRouteId: "route-001", affectedVehicleId: "vehicle-001", category: "accident" });
    expect(result.incidents[0].distanceToRouteKm).toBeLessThan(0.1);
    expect(fetchImpl).toHaveBeenCalledWith("/api/live-traffic", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("rejects invalid XML rather than publishing fabricated incidents", () => {
    expect(() => parseDgtDatex2("<not-closed>")).toThrow("invalid DATEX II XML");
  });
});
