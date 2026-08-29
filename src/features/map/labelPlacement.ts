export type ScreenRect = { height: number; width: number; x: number; y: number };
export type ScreenPoint = { id: string; x: number; y: number };

const LABEL = { height: 28, width: 104 };
const directions = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]] as const;

export function rectanglesIntersect(left: ScreenRect, right: ScreenRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function contained(rect: ScreenRect, bounds: ScreenRect): boolean {
  return rect.x >= bounds.x && rect.y >= bounds.y && rect.x + rect.width <= bounds.x + bounds.width && rect.y + rect.height <= bounds.y + bounds.height;
}

function candidate(point: ScreenPoint, direction: readonly [number, number], radius: number): ScreenRect {
  const [horizontal, vertical] = direction;
  return { height: LABEL.height, width: LABEL.width, x: point.x + horizontal * radius - (horizontal <= 0 ? LABEL.width : 0), y: point.y + vertical * radius - (vertical <= 0 ? LABEL.height : 0) };
}

export function placeLabels(points: readonly ScreenPoint[], bounds: ScreenRect, obstacles: readonly ScreenRect[]): Array<{ id: string; rect: ScreenRect }> {
  const occupied = [...obstacles];
  return [...points].sort((left, right) => left.id.localeCompare(right.id)).map((point) => {
    const candidates = [24, 56, 88, 120, 152, 184, 216, 248].flatMap((radius) => directions.map((direction) => candidate(point, direction, radius)));
    const rect = candidates.find((entry) => contained(entry, bounds) && occupied.every((obstacle) => !rectanglesIntersect(entry, obstacle))) ?? {
      height: LABEL.height, width: LABEL.width,
      x: Math.min(Math.max(point.x + 24, bounds.x), bounds.x + bounds.width - LABEL.width),
      y: Math.min(Math.max(point.y - LABEL.height, bounds.y), bounds.y + bounds.height - LABEL.height),
    };
    occupied.push(rect);
    return { id: point.id, rect };
  });
}
