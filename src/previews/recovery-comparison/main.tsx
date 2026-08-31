import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "../../styles.css";
import "./recoveryComparisonPreview.css";
import { RecoveryComparisonPreview } from "./RecoveryComparisonPreview";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

const root = document.getElementById("root");
if (root === null) throw new Error("The recovery comparison preview root is unavailable.");
document.documentElement.lang = "en";
createRoot(root).render(<StrictMode><RecoveryComparisonPreview model={createUnit211RecoveryPreviewModel()} /></StrictMode>);
