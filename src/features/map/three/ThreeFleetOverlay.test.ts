import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlaySource = readFileSync("src/features/map/three/ThreeFleetOverlay.tsx", "utf8");

describe("ThreeFleetOverlay scene geometry", () => {
  it("should reserve circular geometry for one neutral contact shadow", () => {
    expect(overlaySource).not.toContain("RingGeometry");
    expect(overlaySource).not.toMatch(/selectionMesh|geometry\.selection|material\.selection/);
    expect(overlaySource.match(/new THREE\.CircleGeometry/g) ?? []).toHaveLength(1);
    expect(overlaySource).toContain("shadow: new THREE.CircleGeometry");
    expect(overlaySource).toContain("shadow: new THREE.MeshBasicMaterial({ color: 0x06111a");
  });
});
