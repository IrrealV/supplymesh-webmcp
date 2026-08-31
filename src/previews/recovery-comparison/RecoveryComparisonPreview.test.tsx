import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoveryComparisonPanel } from "./RecoveryComparisonPanel";
import { createUnit211RecoveryPreviewModel } from "./unit211RecoveryPreviewModel";

describe("Recovery comparison preview", () => {
  it("should expose comparison semantics without enabling workflow actions", () => {
    render(<RecoveryComparisonPanel model={createUnit211RecoveryPreviewModel()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Recovery comparison" }).textContent).toBe("Recovery comparison");
    expect(screen.getByText("3.80 + 0.20 = 4.00 m required").textContent).toBe("3.80 + 0.20 = 4.00 m required");
    expect(screen.getByRole("article", { name: "Keep current route, rejected" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("article", { name: "Use alternative route, valid option" }).getAttribute("aria-disabled")).toBeNull();
    expect((screen.getByRole("button", { name: "Prepare plan" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Preview only — no plan will be prepared.").textContent).toBe("Preview only — no plan will be prepared.");
    expect(screen.queryByText(/cost|toll|fuel|emission|road name/i)).toBeNull();
  });

  it("should keep the secondary entry and fixture access isolated from production", () => {
    const html = readFileSync("recovery-comparison-preview.html", "utf8");
    const production = ["src/main.tsx", "src/app/App.tsx", "vite.config.ts"].map((path) => readFileSync(path, "utf8")).join("\n");
    const presentation = ["RecoveryComparisonPreview.tsx", "RecoveryComparisonPanel.tsx", "RecoveryComparisonMap.tsx"].map((path) => readFileSync(`src/previews/recovery-comparison/${path}`, "utf8")).join("\n");
    const map = readFileSync("src/previews/recovery-comparison/RecoveryComparisonMap.tsx", "utf8");
    const styles = readFileSync("src/previews/recovery-comparison/recoveryComparisonPreview.css", "utf8");
    const model = readFileSync("src/previews/recovery-comparison/unit211RecoveryPreviewModel.ts", "utf8");

    expect(html).toContain('/src/previews/recovery-comparison/main.tsx');
    expect(production).not.toMatch(/recovery-comparison|src\/previews/);
    expect(presentation).not.toMatch(/scenario\/fixtures|OperationsApi|ScenarioRepository|createAssessAuthoritativeVerticalClearance|fetch\s*\(/);
    expect(model).toContain("createAssessAuthoritativeVerticalClearance");
    expect(model).toContain("clearanceAlternativeCatalog");
    expect(map).toContain("Incident detail · Exact 250 m zone");
    expect(map).toContain("zoom={14}");
    expect(map).toContain('MapAccessibility label="Route comparison map"');
    expect(map).toContain('aria-label="Unit 211 at Toledo before departure"');
    expect(styles).toMatch(/\.recovery-map-legend[^}]*right:/);
  });
});
