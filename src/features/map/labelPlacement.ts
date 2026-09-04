export type ScreenRect = { height: number; width: number; x: number; y: number };
export type ScreenPoint = { id: string; x: number; y: number };

const LABEL = { height: 30, width: 112 };
const LOCAL_STEP = 24;
const GLOBAL_STEP = 8;

export function rectanglesIntersect(left: ScreenRect, right: ScreenRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function contained(rect: ScreenRect, bounds: ScreenRect): boolean {
  return rect.x >= bounds.x && rect.y >= bounds.y && rect.x + rect.width <= bounds.x + bounds.width && rect.y + rect.height <= bounds.y + bounds.height;
}

function centeredCandidate(point: ScreenPoint, offsetX: number, offsetY: number): ScreenRect {
  return {
    height: LABEL.height,
    width: LABEL.width,
    x: point.x + offsetX - LABEL.width / 2,
    y: point.y + offsetY - LABEL.height / 2,
  };
}

function localCandidates(point: ScreenPoint, bounds: ScreenRect): ScreenRect[] {
  const maximumRadius = Math.ceil(Math.hypot(bounds.width, bounds.height));
  const candidates: ScreenRect[] = [];

  for (let radius = 28; radius <= maximumRadius; radius += LOCAL_STEP) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += LOCAL_STEP) {
      candidates.push(centeredCandidate(point, offsetX, -radius));
      candidates.push(centeredCandidate(point, offsetX, radius));
    }
    for (let offsetY = -radius + LOCAL_STEP; offsetY < radius; offsetY += LOCAL_STEP) {
      candidates.push(centeredCandidate(point, -radius, offsetY));
      candidates.push(centeredCandidate(point, radius, offsetY));
    }
  }

  return candidates;
}

function viewportCandidates(point: ScreenPoint, bounds: ScreenRect): ScreenRect[] {
  const lastX = bounds.x + bounds.width - LABEL.width;
  const lastY = bounds.y + bounds.height - LABEL.height;
  const candidates: Array<{ distance: number; rect: ScreenRect }> = [];

  for (let y = bounds.y; y <= lastY; y += GLOBAL_STEP) {
    for (let x = bounds.x; x <= lastX; x += GLOBAL_STEP) {
      const centerX = x + LABEL.width / 2;
      const centerY = y + LABEL.height / 2;
      candidates.push({
        distance: (centerX - point.x) ** 2 + (centerY - point.y) ** 2,
        rect: { height: LABEL.height, width: LABEL.width, x, y },
      });
    }
  }

  if ((lastX - bounds.x) % GLOBAL_STEP !== 0 || (lastY - bounds.y) % GLOBAL_STEP !== 0) {
    candidates.push({
      distance: (lastX + LABEL.width / 2 - point.x) ** 2 + (lastY + LABEL.height / 2 - point.y) ** 2,
      rect: { height: LABEL.height, width: LABEL.width, x: lastX, y: lastY },
    });
  }

  return candidates.sort((left, right) => left.distance - right.distance || left.rect.y - right.rect.y || left.rect.x - right.rect.x).map(({ rect }) => rect);
}

function firstAvailable(candidates: readonly ScreenRect[], bounds: ScreenRect, occupied: readonly ScreenRect[]): ScreenRect | undefined {
  return candidates.find((entry) => contained(entry, bounds) && occupied.every((obstacle) => !rectanglesIntersect(entry, obstacle)));
}

export function placeLabels(points: readonly ScreenPoint[], bounds: ScreenRect, obstacles: readonly ScreenRect[]): Array<{ id: string; rect: ScreenRect }> {
  const occupied = [...obstacles];

  return [...points].sort((left, right) => left.id.localeCompare(right.id)).map((point) => {
    const rect = firstAvailable(localCandidates(point, bounds), bounds, occupied)
      ?? firstAvailable(viewportCandidates(point, bounds), bounds, occupied)
      ?? {
        height: LABEL.height,
        width: LABEL.width,
        x: Math.min(Math.max(point.x - LABEL.width / 2, bounds.x), bounds.x + bounds.width - LABEL.width),
        y: Math.min(Math.max(point.y - LABEL.height / 2, bounds.y), bounds.y + bounds.height - LABEL.height),
      };

    occupied.push(rect);
    return { id: point.id, rect };
  });
}
