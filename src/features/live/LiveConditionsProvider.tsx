import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { LiveConditionsSnapshot, LiveConditionsStore } from "../../live/liveConditions";
import type { Locale } from "../../preferences/i18n/catalog";
import { LiveConditionsMapBridge } from "./LiveConditionsMapBridge";
import { LiveConditionsPanel } from "./LiveConditionsPanel";

type LiveConditionsContextValue = Readonly<{
  snapshot: LiveConditionsSnapshot;
  store: LiveConditionsStore;
}>;

const LiveConditionsContext = createContext<LiveConditionsContextValue | null>(null);

export function LiveConditionsProvider({ children, locale, store }: { children: ReactNode; locale: Locale; store: LiveConditionsStore }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.read, store.read);
  return (
    <LiveConditionsContext.Provider value={{ snapshot, store }}>
      {children}
      <LiveConditionsMapBridge locale={locale} snapshot={snapshot} />
      <LiveConditionsPanel locale={locale} snapshot={snapshot} store={store} />
    </LiveConditionsContext.Provider>
  );
}

export function useLiveConditions(): LiveConditionsContextValue {
  const value = useContext(LiveConditionsContext);
  if (value === null) throw new Error("LiveConditionsProvider is unavailable.");
  return value;
}
