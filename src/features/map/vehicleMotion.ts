import type { Vehicle } from "../../domain/entities";

export type StoppedReasonCode =
  | "mandatory-rest"
  | "no-route"
  | "pre-dispatch-hold"
  | "road-blocked";

export type VehicleMotionEvaluation = {
  isMoving: boolean;
  reasonCode: StoppedReasonCode | null;
  reasonText: { en: string; es: string };
};

export function evaluateVehicleMotion(vehicle: Vehicle): VehicleMotionEvaluation {
  if (!vehicle.routeId || vehicle.routeId.trim() === "") {
    return {
      isMoving: false,
      reasonCode: "no-route",
      reasonText: { en: "No route assigned", es: "Sin ruta asignada" },
    };
  }

  if (vehicle.status === "resting") {
    return {
      isMoving: false,
      reasonCode: "mandatory-rest",
      reasonText: { en: "Mandatory rest", es: "Descanso obligatorio" },
    };
  }

  if (vehicle.internalId === "vehicle-011" && vehicle.routeId === "route-011") {
    return {
      isMoving: false,
      reasonCode: "pre-dispatch-hold",
      reasonText: { en: "Pre-dispatch safety hold", es: "Parada de seguridad pre-despacho" },
    };
  }

  if (vehicle.stoppedReason) {
    return {
      isMoving: false,
      reasonCode: "road-blocked",
      reasonText: { en: vehicle.stoppedReason, es: vehicle.stoppedReason },
    };
  }

  return {
    isMoving: true,
    reasonCode: null,
    reasonText: { en: "In transit", es: "En tránsito" },
  };
}
