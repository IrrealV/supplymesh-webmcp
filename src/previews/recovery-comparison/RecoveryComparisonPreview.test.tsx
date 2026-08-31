import { readFileSync, readdirSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createApplication } from "../../app/createApplication";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { RecoveryComparisonPanel } from "../../features/recovery-comparison/RecoveryComparisonPanel";
import { RecoveryComparisonPreview } from "./RecoveryComparisonPreview";
import { createUnit211RecoveryComparisonModel } from "../../features/recovery-comparison/unit211RecoveryComparisonModel";

afterEach(cleanup);

function realPreviewModel() {
  const model = createUnit211RecoveryComparisonModel(createApplication().unit211PreDispatchContext(), "en");
  if (model.kind !== "ready") throw new Error(`Expected preview data, received ${model.reasonCode}.`);
  return model;
}

function realFailureState() {
  const state = createUnit211RecoveryComparisonModel(createOperationsApi(createZustandScenarioRepository()).unit211PreDispatchContext(), "en");
  if (state.kind !== "operation-failure") throw new Error("Expected a structured pre-dispatch failure.");
  return state;
}

describe("Recovery comparison preview", () => {
  it("should compose the route overview and options through the public preview", () => {
    render(<RecoveryComparisonPreview state={realPreviewModel()} />);

    const overview = screen.getByRole("region", { name: "Recovery route comparison overview" });
    const interactiveMap = screen.getByRole("region", { name: "Interactive recovery route map" });
    expect(interactiveMap.getAttribute("aria-describedby")).toBe("recovery-map-summary");
    expect(overview.querySelector("#recovery-map-summary")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Recovery comparison" })).not.toBeNull();
    expect(screen.getByRole("article", { name: "Use alternative route, Supported for comparison" })).not.toBeNull();
  });

  it("should expose domain-backed comparison semantics without enabling workflow actions", () => {
    render(<RecoveryComparisonPanel locale="en" model={realPreviewModel()} showPreviewAction />);

    expect(screen.getByRole("heading", { level: 1, name: "Recovery comparison" }).textContent).toBe("Recovery comparison");
    expect(screen.getByText("3.80 + 0.20 = 4.00 m required").textContent).toBe("3.80 + 0.20 = 4.00 m required");
    expect(screen.getAllByText("CLEARANCE_VIOLATION")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Keep current route, Rejected" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("article", { name: "Use alternative route, Supported for comparison" }).getAttribute("aria-disabled")).toBeNull();
    expect(document.body.textContent).not.toMatch(/REJECTED|SUPPORTED_FOR_COMPARISON/);
    expect((screen.getByRole("button", { name: "Prepare plan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Preview only — no plan will be prepared.").textContent).toBe("Preview only — no plan will be prepared.");
    expect(screen.queryByText(/cost|toll|fuel|emission|road name/i)).toBeNull();
  });

  it("should render a named accessible state for a structured operation failure", () => {
    const state = realFailureState();
    render(<RecoveryComparisonPreview state={state} />);

    const alert = screen.getByRole("alert", { name: "Recovery comparison unavailable" });
    expect(alert.textContent).toContain(state.reasonCode);
    expect(alert.textContent).toContain("No route was changed.");
    expect(screen.queryByRole("region", { name: "Recovery route comparison overview" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Route options" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prepare plan" })).toBeNull();
  });

  it("should bind only the isolated preview bootstrap to the pre-dispatch operation", () => {
    const html = readFileSync("recovery-comparison-preview.html", "utf8");
    const production = ["src/main.tsx", "src/app/App.tsx", "vite.config.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    const bootstrap = readFileSync("src/previews/recovery-comparison/main.tsx", "utf8");
    const presentation = ["src/previews/recovery-comparison/RecoveryComparisonPreview.tsx", "src/previews/recovery-comparison/RecoveryComparisonMap.tsx", "src/features/recovery-comparison/RecoveryComparisonPanel.tsx"].map((path) => readFileSync(path, "utf8")).join("\n");
    const model = readFileSync("src/features/recovery-comparison/unit211RecoveryComparisonModel.ts", "utf8");

    expect(html).toContain('/src/previews/recovery-comparison/main.tsx');
    expect(production).not.toMatch(/src\/previews/);
    expect(presentation).not.toMatch(/scenario\/fixtures|OperationsApi|ScenarioRepository|createAssessAuthoritativeVerticalClearance|fetch\s*\(/);
    expect(model).not.toMatch(/scenario\/fixtures|clearanceAlternativeCatalog|createSpainScenario|authoritativeVerticalAssessment|createAssessAuthoritativeVerticalClearance/);
    expect(bootstrap).toContain("createApplication");
    expect(bootstrap.match(/unit211PreDispatchContext\(\)/g)).toHaveLength(1);
    expect(bootstrap).not.toMatch(/scenario\/fixtures|clearanceAlternativeCatalog|createSpainScenario|authoritativeVerticalAssessment/);
    const productionFiles = readdirSync("src", { recursive: true }).filter((path) => typeof path === "string" && /\.(?:ts|tsx)$/.test(path) && !path.startsWith("previews/")).map((path) => readFileSync(`src/${path}`, "utf8")).join("\n");
    expect(productionFiles).not.toMatch(/from\s+["'][^"']*previews\//);
  });
});
