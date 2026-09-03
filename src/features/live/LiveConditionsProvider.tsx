import { useSyncExternalStore, type ReactNode } from "react";
import type { LiveConditionsStore } from "../../live/liveConditions";
import type { Locale } from "../../preferences/i18n/catalog";
import { LiveConditionsMapBridge } from "./LiveConditionsMapBridge";
import { LiveConditionsPanel } from "./LiveConditionsPanel";
import "./liveConditionsPosition.css";

export function LiveConditionsProvider({ children, locale, store }: { children: ReactNode; locale: Locale; store: LiveConditionsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.read, store.read);
  return (
    <>
      {children}
      <LiveConditionsMapBridge locale={locale} snapshot={snapshot} />
      <LiveConditionsPanel locale={locale} snapshot={snapshot} store={store} />
    </>
  );
}
