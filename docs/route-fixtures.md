# Reviewed ORS route fixtures

SupplyMesh uses checked-in openrouteservice `driving-hgv` GeoJSON at runtime. The browser never contacts ORS and never needs `ORS_API_KEY`.

## Generate

Inject the key into the process without an environment file:

```bash
ORS_API_KEY=<secret> bun --no-env-file run routes:generate
```

The command sends the manifest's logical `[longitude, latitude]` endpoints unchanged. Only route-014 includes `radiuses: [547, 350]`; all other routes omit radiuses and use ORS's 350 m default. A missing key, quota/HTTP failure, malformed or surplus response, invalid endpoint snap, or incomplete route set leaves the accepted fixture untouched. Retry only 429 and 5xx responses, honoring bounded `Retry-After` delays.

## Verify and review

```bash
bun --no-env-file run routes:verify
```

Verification needs no key. It checks all route IDs, schema/provider/profile, logical and returned endpoints, configured/default snap radiuses, Spain bounds, summaries, full multi-point geometry, risk indices, canonical `sourceRevision`, and the offline runtime boundary.

`src/scenario/fixtures/ors-routes.geojson` is generated: never hand-edit, pre-snap, simplify, smooth, patch, or replace its coordinates. Review manifest changes first, then provenance/hash, endpoint snap distances, route summaries, risk references, and the complete geometry diff. `generatedAt` changes only when canonical source material changes; identical generation is a byte/timestamp-preserving no-op. The file stores safe provider/profile/hash metadata only—never credentials, headers, raw responses, or volatile provider build data.

## Clearance alternative

Generate the single Unit 211 clearance alternative with `ORS_API_KEY=<secret> bun --no-env-file run routes:clearance:generate`, then verify it without a key using `bun --no-env-file run routes:clearance:verify`. The command keeps the original endpoints, sends one 250 m avoid polygon to `driving-hgv`, and admits only a disjoint route within endpoint and 2× summary bounds.

`clearance-alternative-route-v1.geojson` is generated evidence: never hand-edit it or its polygon. Its static catalog is offline and intentionally unused by the application, UI, scenario composition, `OperationsApi`, and WebMCP in this batch.
