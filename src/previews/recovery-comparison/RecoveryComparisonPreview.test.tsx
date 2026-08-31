import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createApplication } from "../../app/createApplication";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import { RecoveryComparisonPreview } from "./RecoveryComparisonPreview";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

afterEach(cleanup);

function realPreviewModel() {
  const model = createUnit211RecoveryPreviewModel(createApplication().unit211PreDispatchContext());
  if (model.kind !== "development-preview") throw new Error(`Expected preview data, received ${model.reasonCode}.`);
  return model;
}

function realFailureState() {
  const state = createUnit211RecoveryPreviewModel(createOperationsApi(createZustandScenarioRepository()).unit211PreDispatchContext());
  if (state.kind !== "operation-failure") throw new Error("Expected a structured pre-dispatch failure.");
  return state;
}

describe("Recovery comparison preview", () => {
  it("should expose domain-backed comparison semantics without enabling workflow actions", () => {
    render(<RecoveryComparisonPanel model={realPreviewModel()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Recovery comparison" }).textContent).toBe("Recovery comparison");
    expect(screen.getByText("3.80 + 0.20 = 4.00 m required").textContent).toBe("3.80 + 0.20 = 4.00 m required");
    expect(screen.getAllByText("CLEARANCE_VIOLATION")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Keep current route, REJECTED" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("article", { name: "Use alternative route, SUPPORTED_FOR_COMPARISON" }).getAttribute("aria-disabled")).toBeNull();
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
    expect(screen.queryByRole("region", { name: "Route comparison map" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Route options" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prepare plan" })).toBeNull();
  });

  it("should bind only the isolated preview bootstrap to the pre-dispatch operation", () => {
    const html = readFileSync("recovery-comparison-preview.html", "utf8");
    const production = ["src/main.tsx", "src/app/App.tsx", "vite.config.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    const bootstrap = readFileSync("src/previews/recovery-comparison/main.tsx", "utf8");
    const presentation = ["RecoveryComparisonPreview.tsx", "RecoveryComparisonPanel.tsx", "RecoveryComparisonMap.tsx"].map((path) => readFileSync(`src/previews/recovery-comparison/${path}`, "utf8")).join("\n");
    const model = readFileSync("src/previews/recovery-comparison/unit211RecoveryPreviewModel.ts", "utf8");

    expect(html).toContain('/src/previews/recovery-comparison/main.tsx');
    expect(production).not.toMatch(/recovery-comparison|src\/previews/);
    expect(presentation).not.toMatch(/scenario\/fixtures|OperationsApi|ScenarioRepository|createAssessAuthoritativeVerticalClearance|fetch\s*\(/);
    expect(model).not.toMatch(/scenario\/fixtures|clearanceAlternativeCatalog|createSpainScenario|authoritativeVerticalAssessment|createAssessAuthoritativeVerticalClearance/);
    expect(bootstrap).toContain("createApplication");
    expect(bootstrap.match(/unit211PreDispatchContext\(\)/g)).toHaveLength(1);
    expect(bootstrap).not.toMatch(/scenario\/fixtures|clearanceAlternativeCatalog|createSpainScenario|authoritativeVerticalAssessment/);
  });
});
