import { describe, expect, it } from "vitest";
import { placeLabels, rectanglesIntersect } from "./labelPlacement";

describe("screen-space vehicle label placement", () => {
  it("should deterministically place all fixture labels inside the viewport without intersections", () => {
    const points = Array.from({ length: 15 }, (_, index) => ({ id: `vehicle-${String(index + 1).padStart(3, "0")}`, x: 330 + index % 5 * 18, y: 230 + Math.floor(index / 5) * 18 })).reverse();
    const obstacles = [{ height: 34, width: 34, x: 348, y: 248 }, { height: 32, width: 62, x: 420, y: 210 }];
    const first = placeLabels(points, { height: 600, width: 820, x: 0, y: 0 }, obstacles);
    const second = placeLabels([...points].reverse(), { height: 600, width: 820, x: 0, y: 0 }, obstacles);

    expect(second).toEqual(first);
    expect(first).toHaveLength(15);
    expect(first.map(({ id }) => id)).toEqual([...first.map(({ id }) => id)].sort());
    expect(first.every(({ rect }) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 820 && rect.y + rect.height <= 600)).toBe(true);
    expect(first.every(({ rect }, index) => obstacles.every((obstacle) => !rectanglesIntersect(rect, obstacle)) && first.slice(index + 1).every((other) => !rectanglesIntersect(rect, other.rect)))).toBe(true);
  });

  it("should use a contained fallback for vehicles at viewport edges", () => {
    const result = placeLabels([{ id: "east", x: 798, y: 10 }, { id: "west", x: 2, y: 590 }], { height: 600, width: 820, x: 0, y: 0 }, []);
    expect(result.every(({ rect }) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 820 && rect.y + rect.height <= 600)).toBe(true);
  });
});
