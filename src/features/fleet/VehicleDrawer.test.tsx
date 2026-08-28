import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationsApi } from "../../domain/operations/createOperationsApi";
import type { OperatingRegion, Vehicle } from "../../domain/entities";
import { createZustandScenarioRepository } from "../../scenario/state/createZustandScenarioRepository";
import { VehicleDrawer } from "./VehicleDrawer";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function resultData<T>(result: { ok: true; data: T } | { ok: false }): T {
  if (!result.ok) {
    throw new Error("Expected successful operations result.");
  }
  return result.data;
}

function renderDrawer(locale: "en" | "es" = "en", overrides: Partial<Vehicle> = {}) {
  const storage = new MemoryStorage();
  const operations = createOperationsApi(createZustandScenarioRepository(storage));
  const scenario = resultData(operations.scenarioCurrent());
  const vehicle = { ...scenario.vehicles[0], ...overrides };
  const onScenarioChange = vi.fn<(next: OperatingRegion) => void>();
  const onClose = vi.fn<() => void>();
  const onRestoreFollow = vi.fn<() => void>();
  const view = render(
    <VehicleDrawer
      isFollowing={false}
      locale={locale}
      onClose={onClose}
      onRestoreFollow={onRestoreFollow}
      onScenarioChange={onScenarioChange}
      operations={operations}
      scenario={scenario}
      vehicle={vehicle}
    />,
  );
  return { onClose, onRestoreFollow, onScenarioChange, operations, storage, vehicle, ...view };
}

describe("VehicleDrawer", () => {
  afterEach(cleanup);

  it("should show complete inspection fields and compare vehicle height to the 3.9 m clearance", () => {
    renderDrawer();

    expect(screen.getByRole("complementary", { name: "Vehicle inspection" })).not.toBeNull();
    expect(screen.getByText("Fleet number")).not.toBeNull();
    expect(screen.getByText("1534 LKT")).not.toBeNull();
    expect(screen.getByText("Madrid")).not.toBeNull();
    expect(screen.getByText("Bilbao")).not.toBeNull();
    expect(screen.getByText("Vehicle height 3.8 m / clearance 3.9 m")).not.toBeNull();
  });

  it("should use localized fallbacks for absent optional values", () => {
    renderDrawer("es", { plate: "", currentRoute: "", cargo: { description: "", priority: "standard", refrigeration: "ambient" } });

    expect(screen.getAllByText("No disponible").length).toBeGreaterThanOrEqual(3);
  });

  it("should validate, save, and immediately publish a label rename through shared operations", async () => {
    const user = userEvent.setup();
    const { onScenarioChange, operations, storage, vehicle } = renderDrawer();

    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), "Night Dispatch");
    await user.click(screen.getByRole("button", { name: "Save label" }));

    expect(screen.getByDisplayValue("Night Dispatch")).not.toBeNull();
    expect(onScenarioChange).toHaveBeenCalledTimes(1);
    expect(resultData(operations.vehicleGet(vehicle.internalId)).label).toBe("Night Dispatch");
    expect(resultData(createOperationsApi(createZustandScenarioRepository(storage)).vehicleGet(vehicle.internalId)).label).toBe("Night Dispatch");
  });

  it("should clear a validation error after a valid label rename", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.clear(screen.getByLabelText("Label"));
    await user.click(screen.getByRole("button", { name: "Save label" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a label with 1 to 64 characters.");

    await user.type(screen.getByLabelText("Label"), "Night Dispatch");
    await user.click(screen.getByRole("button", { name: "Save label" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should offer follow only after it is disabled", async () => {
    const user = userEvent.setup();
    const { onRestoreFollow } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Follow FM-201" }));

    expect(onRestoreFollow).toHaveBeenCalledTimes(1);
  });

  it("should render inspection as a dialog on tablet viewports", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ addEventListener: () => undefined, matches: true, removeEventListener: () => undefined }) });

    try {
      renderDrawer();

      expect(screen.getByRole("dialog", { name: "FM-201" })).not.toBeNull();
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
    }
  });

  it("should name the vehicle, leave it unchanged on cancel, and delete its route after confirmation", async () => {
    const user = userEvent.setup();
    const { onClose, operations, vehicle } = renderDrawer();

    await user.click(screen.getByRole("button", { name: "Delete vehicle" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("FM-201");
    expect(screen.getByRole("alertdialog").textContent).toContain("current route");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(resultData(operations.vehicleGet(vehicle.internalId)).internalId).toBe(vehicle.internalId);

    await user.click(screen.getByRole("button", { name: "Delete vehicle" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(operations.vehicleGet(vehicle.internalId).ok).toBe(false);
    expect(resultData(operations.scenarioCurrent()).routes.some((route) => route.vehicleId === vehicle.internalId)).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
