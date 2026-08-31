import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OperatingRegion, Vehicle } from "../../domain/entities";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { VehicleInspection } from "./VehicleInspection";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function resultData<T>(result: { ok: true; data: T } | { ok: false }): T {
  if (!result.ok) throw new Error("Expected successful operations result.");
  return result.data;
}

function renderInspection(locale: "en" | "es" = "en", overrides: Partial<Vehicle> = {}) {
  const storage = new MemoryStorage();
  const operations = createOperationsApi(createZustandScenarioRepository(storage));
  const scenario = resultData(operations.scenarioCurrent());
  const vehicle = { ...scenario.vehicles[0], ...overrides };
  const callbacks = {
    onClose: vi.fn<() => void>(), onRestoreFollow: vi.fn<() => void>(),
    onScenarioChange: vi.fn<(next: OperatingRegion) => void>(), onViewRoute: vi.fn<() => void>(),
  };
  render(<VehicleInspection {...callbacks} isFollowing={false} locale={locale} operations={operations} scenario={scenario} vehicle={vehicle} />);
  return { ...callbacks, operations, storage, vehicle };
}

describe("VehicleInspection", () => {
  afterEach(cleanup);

  it("should render hierarchical operational context without raw keys or ISO values", async () => {
    const user = userEvent.setup();
    renderInspection("en", { timing: { delayMinutes: 25, eta: "2026-08-28T10:30:00Z", remainingDriveMinutes: 273, restDeadline: "2026-08-28T06:00:00Z" } });

    expect(screen.getByRole("heading", { name: "Identity" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Operational summary" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Why attention is needed" })).not.toBeNull();
    expect(screen.getByText("Madrid → Bilbao")).not.toBeNull();
    expect(screen.getByText(/Vehicle height 3.8 m.*clearance 3.9 m/)).not.toBeNull();
    expect(document.body.textContent).not.toContain("2026-08-28T");
    expect(document.body.textContent).not.toContain("route-001");

    expect(screen.getByRole("tab", { name: "Vehicle" }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Driver" }));
    expect(screen.getByText("4h 33m")).not.toBeNull();
    const cargoTab = screen.getByRole("tab", { name: "Cargo" });
    await user.click(cargoTab);
    expect(cargoTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Medical supplies");
  });

  it("should enable Save only for a valid changed label and persist the result", async () => {
    const user = userEvent.setup();
    const { operations, storage, vehicle } = renderInspection();
    const input = screen.getByLabelText("Label");
    const save = screen.getByRole("button", { name: "Save label" });

    expect(save.hasAttribute("disabled")).toBe(true);
    await user.type(input, "x");
    await user.clear(input);
    expect(save.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("Enter a label with 1 to 64 characters.");
    await user.type(input, "Night Dispatch");
    expect(save.hasAttribute("disabled")).toBe(false);
    await user.click(save);

    expect(screen.getByRole("status").textContent).toBe("Label saved.");
    expect(save.hasAttribute("disabled")).toBe(true);
    expect(resultData(operations.vehicleGet(vehicle.internalId)).label).toBe("Night Dispatch");
    expect(resultData(createOperationsApi(createZustandScenarioRepository(storage)).vehicleGet(vehicle.internalId)).label).toBe("Night Dispatch");
  });

  it("should focus or follow the route without closing inspection", async () => {
    const user = userEvent.setup();
    const { onClose, onRestoreFollow, onViewRoute } = renderInspection();

    await user.click(screen.getByRole("button", { name: "View on route" }));
    await user.click(screen.getByRole("button", { name: "Follow FM-201" }));

    expect(onViewRoute).toHaveBeenCalledTimes(1);
    expect(onRestoreFollow).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should expose the optional recovery review action without changing existing actions", async () => {
    const user = userEvent.setup(); const onReviewRecovery = vi.fn<() => void>();
    const storage = new MemoryStorage(); const operations = createOperationsApi(createZustandScenarioRepository(storage)); const scenario = resultData(operations.scenarioCurrent());
    render(<VehicleInspection isFollowing={false} locale="en" onClose={() => undefined} onRestoreFollow={() => undefined} onReviewRecovery={onReviewRecovery} onScenarioChange={() => undefined} onViewRoute={() => undefined} operations={operations} scenario={scenario} vehicle={scenario.vehicles[0]} />);

    await user.click(screen.getByRole("button", { name: "Review recovery options" }));
    expect(onReviewRecovery).toHaveBeenCalledTimes(1);
  });

  it("should localize inspection copy, values, dates, and tabs in Spanish", async () => {
    const user = userEvent.setup();
    renderInspection("es");

    expect(screen.getByRole("heading", { name: "Identidad" })).not.toBeNull();
    expect(screen.getByText("En ruta")).not.toBeNull();
    expect(document.body.textContent).toContain("28 ago 2026");
    screen.getByRole("tab", { name: "Conductor" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tabpanel").textContent).toContain("Conducción restante");
  });

  it("should use localized fallbacks for absent optional values", () => {
    renderInspection("es", { plate: "", cargo: { description: "", priority: "standard", refrigeration: "ambient" }, dimensions: { heightMeters: 3.8, lengthMeters: 16.5, vehicleType: "", weightTonnes: 18 } });

    expect(screen.getAllByText("No disponible").length).toBeGreaterThanOrEqual(2);
  });

  it("should use a trapped, closable dialog on tablet", async () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });
    try {
      const user = userEvent.setup();
      const { onClose } = renderInspection();
      expect(screen.getByRole("dialog", { name: "FM-201" }).getAttribute("aria-label")).toBe("Vehicle inspection");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    } finally { Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia }); }
  });

  it("should preserve cancel and confirmed deletion behavior", async () => {
    const user = userEvent.setup();
    const { onClose, operations, vehicle } = renderInspection();

    await user.click(screen.getByRole("button", { name: "Delete vehicle" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("FM-201");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(operations.vehicleGet(vehicle.internalId).ok).toBe(true);
    await user.click(screen.getByRole("button", { name: "Delete vehicle" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(operations.vehicleGet(vehicle.internalId).ok).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
