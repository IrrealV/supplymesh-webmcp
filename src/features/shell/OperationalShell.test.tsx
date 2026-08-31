import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiCoordinationStore } from "../../app/state/useUiCoordinationStore";
import { createSpainScenario } from "../../scenario/fixtures/spain-v1";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { createApplication } from "../../app/createApplication";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { OperationalShell } from "./OperationalShell";
import { Topbar } from "./Topbar";
import { TABLET_MEDIA_QUERY } from "../../app/presentation/useTabletViewport";

const styles = readFileSync("src/styles.css", "utf8");

vi.mock("../map/FleetMap", () => ({ FleetMap: ({ comparison }: { comparison?: { kind: string } }) => <div data-comparison={comparison?.kind ?? "none"} data-testid="fleet-map" /> }));

function resetUi(): void {
  useUiCoordinationStore.setState(useUiCoordinationStore.getInitialState(), true);
}

describe("OperationalShell", () => {
  beforeEach(resetUi);
  afterEach(cleanup);

  it("should render approved landmarks and overview chrome before selection", async () => {
    const user = userEvent.setup();
    render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);

    const banner = screen.getByRole("banner");
    expect(screen.getByText("SupplyMesh")).not.toBeNull();
    expect(banner.querySelectorAll("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Help" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Account" })).not.toBeNull();
    expect(screen.getByRole("main")).not.toBeNull();
    expect(screen.getByRole("complementary", { name: "Fleet filters" })).not.toBeNull();
    expect(screen.getByRole("complementary", { name: "Operational overview" }).getAttribute("data-context-mode")).toBe("overview");
    expect(screen.getByRole("heading", { name: "Operational overview" })).not.toBeNull();
    expect(screen.getByTestId("fleet-map")).not.toBeNull();
    expect(screen.queryByText(/LIVE|WebMCP|Agent|Simulation|Chat/i)).toBeNull();
    expect(screen.queryByRole("complementary", { name: /inspection/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByText("English")).not.toBeNull();
    expect(screen.getByText("Español")).not.toBeNull();
  });

  it("should move keyboard focus from the skip link to the map workspace", async () => {
    const user = userEvent.setup();
    render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);

    await user.tab();
    const skipLink = screen.getByRole("link", { name: "Operational map workspace" });
    expect(document.activeElement).toBe(skipLink);

    await user.click(skipLink);
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Operational map workspace" }));
  });

  it("should coordinate replacement selection and close without mutating scenario data", () => {
    const scenario = createSpainScenario();

    useUiCoordinationStore.getState().selectVehicle("vehicle-001");
    useUiCoordinationStore.getState().selectVehicle("vehicle-002");
    expect(useUiCoordinationStore.getState().selection).toEqual({ kind: "vehicle", vehicleId: "vehicle-002" });
    useUiCoordinationStore.getState().closeSelection();

    expect(useUiCoordinationStore.getState().selection).toEqual({ kind: "none" });
    expect(scenario.vehicles).toHaveLength(15);
  });

  it("should prioritize inspection then restore filtered results and card focus", async () => {
    const user = userEvent.setup();
    render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);

    await user.click(screen.getByRole("button", { name: "Critical" }));
    const result = screen.getByRole("button", { name: "Select Unit 204" });
    await user.click(result);
    expect(screen.getByRole("complementary", { name: "Vehicle inspection" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Close inspection" }));
    expect(screen.getByRole("heading", { name: "Critical" })).not.toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Select Unit 204" }));
  });

  it("should restore filtered context focus when deletion removes the invoking card", async () => {
    const user = userEvent.setup();
    const operations = createOperationsApi(createZustandScenarioRepository());
    function ScenarioHarness() {
      const initial = operations.scenarioCurrent();
      if (!initial.ok) throw new Error("Expected scenario data.");
      const [scenario, setScenario] = useState(initial.data);
      return <OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={setScenario} operations={operations} scenario={scenario} />;
    }
    render(<ScenarioHarness />);

    await user.click(screen.getByRole("button", { name: "Critical" }));
    await user.click(screen.getByRole("button", { name: "Select Unit 204" }));
    await user.click(screen.getByRole("button", { name: "Delete vehicle" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Select Unit 204" })).toBeNull());
    expect(screen.getByRole("heading", { name: "Critical" })).toBe(document.activeElement);
    expect(useUiCoordinationStore.getState().panelContext.mode).toBe("results");
  });

  it("should define the desktop grid, operational tokens, focus, and reduced-motion fallback", () => {
    expect(styles).toContain("--chrome: #0b1726");
    expect(styles).toContain("--panel: #f3f6f7");
    expect(styles).toContain("grid-template-columns: 64px minmax(0, 1fr) clamp(336px, 27vw, 400px)");
    expect(styles).toContain("outline: 2px solid var(--focus)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(TABLET_MEDIA_QUERY).toBe("(min-width: 701px) and (max-width: 1279px)");
  });

  it("should switch the visible language immediately", async () => {
    const user = userEvent.setup();
    function LocalizedTopbar() { const [locale, setLocale] = useState<"en" | "es">("en"); return <Topbar locale={locale} onLocaleChange={setLocale} />; }
    render(<LocalizedTopbar />);

    const language = screen.getByRole("button", { name: "Language" });
    expect(language.textContent).toBe("EN ▾");
    language.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(screen.getByRole("button", { name: "Ayuda" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Idioma" })).not.toBeNull();
  });

  it("should render tablet results as a trapped, closable dialog and restore focus", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });
    try {
      const user = userEvent.setup();
      render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);
      expect(screen.getByRole("button", { name: "Open operational overview" })).not.toBeNull();
      expect(screen.queryByRole("dialog", { name: "Operational overview" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Critical" }));
      expect(screen.getByRole("dialog", { name: "Fleet filters" })).not.toBeNull();
      expect(useUiCoordinationStore.getState().railState).toBe("compact");
      await user.click(screen.getByRole("button", { name: "Close results" }));

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fleet filters" })).toBeNull());
      expect(screen.getByRole("button", { name: "Open operational overview" })).not.toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Critical" }));
    } finally { Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia }); }
  });

  it("should expose a dismissible overview drawer on tablet without expanding the filter rail", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });
    try {
      const user = userEvent.setup();
      render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createOperationsApi(createZustandScenarioRepository())} scenario={createSpainScenario()} />);

      await user.click(screen.getByRole("button", { name: "Open operational overview" }));
      expect(screen.getByRole("dialog", { name: "Operational overview" })).not.toBeNull();
      expect(useUiCoordinationStore.getState().railState).toBe("compact");

      await user.click(screen.getByRole("button", { name: "Close operational overview" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Operational overview" })).toBeNull());
    } finally { Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia }); }
  });

  it.each([
    ["en", "Review recovery options", "Recovery comparison", "Back to vehicle details"],
    ["es", "Revisar opciones de recuperación", "Comparación de recuperación", "Volver al detalle del vehículo"],
  ] as const)("should open and leave the read-only comparison in %s with keyboard focus restored", async (locale, actionLabel, heading, backLabel) => {
    const user = userEvent.setup();
    const operations = createApplication();
    useUiCoordinationStore.getState().selectVehicle("vehicle-011", "operational-map");
    render(<OperationalShell locale={locale} onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={operations} scenario={createSpainScenario()} />);

    const action = screen.getByRole("button", { name: actionLabel });
    await user.click(action);
    expect(screen.getByRole("heading", { name: heading })).not.toBeNull();
    expect(screen.getByTestId("fleet-map").dataset.comparison).toBe("ready");
    expect(screen.queryByRole("button", { name: /prepare|approve|execute|preparar|aprobar|ejecutar/i })).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: actionLabel })));
    expect(screen.queryByRole("heading", { name: heading })).toBeNull();
    expect(screen.queryByRole("button", { name: backLabel })).toBeNull();
    await user.keyboard("{Escape}");
    expect(useUiCoordinationStore.getState().selection).toEqual({ kind: "none" });
  });

  it("should show the exact structured failure returned after the review action", async () => {
    const user = userEvent.setup(); const real = createApplication(); const ready = real.unit211PreDispatchContext(); let calls = 0;
    const operations: OperationsApi = { ...real, unit211PreDispatchContext: () => ++calls === 1 ? ready : { ok: false, reasonCode: "ALTERNATIVE_SOURCE_UNAVAILABLE" } };
    useUiCoordinationStore.getState().selectVehicle("vehicle-011", "operational-map");
    render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={operations} scenario={createSpainScenario()} />);

    await user.click(screen.getByRole("button", { name: "Review recovery options" }));
    const alert = screen.getByRole("alert", { name: "Recovery comparison unavailable" });
    expect(alert.textContent).toContain("ALTERNATIVE_SOURCE_UNAVAILABLE");
    expect(alert.textContent).toContain("No route was changed.");
    expect(screen.getByTestId("fleet-map").dataset.comparison).toBe("none");
  });

  it("should keep comparison inside the tablet vehicle dialog and use Escape as Back first", async () => {
    const originalMatchMedia = window.matchMedia; Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });
    try {
      const user = userEvent.setup(); useUiCoordinationStore.getState().selectVehicle("vehicle-011", "operational-map");
      render(<OperationalShell locale="en" onLocaleChange={() => undefined} onScenarioChange={() => undefined} operations={createApplication()} scenario={createSpainScenario()} />);
      await user.click(screen.getByRole("button", { name: "Review recovery options" }));
      expect(screen.getByRole("dialog", { name: "Unit 211" }).getAttribute("aria-label")).toBe("Vehicle inspection");
      expect(screen.getByRole("heading", { name: "Recovery comparison" })).not.toBeNull();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Review recovery options" })));
    } finally { Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia }); }
  });
});
