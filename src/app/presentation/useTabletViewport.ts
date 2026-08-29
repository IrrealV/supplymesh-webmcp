import { useEffect, useState } from "react";

export const TABLET_MEDIA_QUERY = "(min-width: 701px) and (max-width: 1279px)";

export function isTabletViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.(TABLET_MEDIA_QUERY).matches === true;
}

export function useTabletViewport(): boolean {
  const [isTablet, setIsTablet] = useState(isTabletViewport);

  useEffect(() => {
    if (window.matchMedia === undefined) return;
    const media = window.matchMedia(TABLET_MEDIA_QUERY);
    const update = (): void => setIsTablet(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isTablet;
}
