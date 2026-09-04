import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./features/recovery-comparison/recoveryComparison.css";
import "./features/map/closeRangeMarker.css";
import { App } from "./app/App";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("The application root is unavailable.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);