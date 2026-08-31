import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "../../styles.css";
import "./recoveryComparisonPreview.css";
import { createApplication } from "../../app/createApplication";
import { RecoveryComparisonPreview } from "./RecoveryComparisonPreview";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

const root = document.getElementById("root");
if (root === null) throw new Error("The recovery comparison preview root is unavailable.");
document.documentElement.lang = "en";
const result = createApplication().unit211PreDispatchContext();
const state = createUnit211RecoveryPreviewModel(result);
createRoot(root).render(<StrictMode><RecoveryComparisonPreview state={state} /></StrictMode>);
