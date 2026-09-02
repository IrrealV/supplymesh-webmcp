import { create } from "zustand";
import { RoutePath, advanceRouteProgress, sampleRoutePath, prepareRoutePath } from "./closeRangeMotion";
import type { Vehicle, Route } from "../../domain/entities";
import { evaluateVehicleMotion } from "./vehicleMotion";

export type VehicleMotionState = {
  progress: number;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  routeId: string;
  isMoving: boolean;
  stoppedReason?: { en: string; es: string };
};

type FleetMotionStore = {
  motions: Record<string, VehicleMotionState>;
  routePaths: Record<string, RoutePath>;
  initialize: (vehicles: readonly Vehicle[], routes: readonly Route[]) => void;
  updateFrame: (elapsedMs: number, routes: readonly Route[], vehicles: readonly Vehicle[]) => void;
};

export const useFleetMotionStore = create<FleetMotionStore>((set) => ({
  motions: {},
  routePaths: {},
  initialize: (vehicles, routes) => {
    const routePaths: Record<string, RoutePath> = {};
    for (const route of routes) {
      routePaths[route.id] = prepareRoutePath(route.geometry.geometry.coordinates);
    }
    set((state) => {
      const motions: Record<string, VehicleMotionState> = {};
      for (const v of vehicles) {
        const existing = state.motions[v.internalId];
        const motionEval = evaluateVehicleMotion(v);
        const speedKmH = v.speedKmH && v.speedKmH > 0 ? v.speedKmH : 82;
        const speed = motionEval.isMoving ? speedKmH / 3.6 : 0;

        if (existing && existing.routeId === v.routeId) {
          motions[v.internalId] = {
            ...existing,
            isMoving: motionEval.isMoving,
            stoppedReason: motionEval.isMoving ? undefined : motionEval.reasonText,
            speed,
          };
        } else {
          motions[v.internalId] = {
            progress: v.routeProgress,
            latitude: v.position.geometry.coordinates[1],
            longitude: v.position.geometry.coordinates[0],
            bearing: 0,
            speed,
            routeId: v.routeId,
            isMoving: motionEval.isMoving,
            stoppedReason: motionEval.isMoving ? undefined : motionEval.reasonText,
          };
        }
      }
      return { routePaths, motions };
    });
  },
  updateFrame: (elapsedMs, routes, vehicles) => {
    set((state) => {
      const newMotions = { ...state.motions };
      for (const v of vehicles) {
        const motionEval = evaluateVehicleMotion(v);
        const speedKmH = v.speedKmH && v.speedKmH > 0 ? v.speedKmH : 82;
        const speed = motionEval.isMoving ? speedKmH / 3.6 : 0;

        const motion = newMotions[v.internalId] || {
          progress: v.routeProgress,
          latitude: v.position.geometry.coordinates[1],
          longitude: v.position.geometry.coordinates[0],
          bearing: 0,
          speed,
          routeId: v.routeId,
          isMoving: motionEval.isMoving,
          stoppedReason: motionEval.isMoving ? undefined : motionEval.reasonText,
        };
        // Reset if route changed mid-frame
        if (motion.routeId !== v.routeId) {
          motion.progress = v.routeProgress;
          motion.routeId = v.routeId;
        }

        motion.isMoving = motionEval.isMoving;
        motion.stoppedReason = motionEval.isMoving ? undefined : motionEval.reasonText;
        motion.speed = speed;
        
        const route = routes.find(r => r.id === v.routeId);
        if (route) {
          const path = state.routePaths[route.id];
          if (path) {
            const newProgress = advanceRouteProgress(motion.progress, elapsedMs, route.summary.distanceMeters, speed);
            const sample = sampleRoutePath(path, newProgress);
            newMotions[v.internalId] = {
              progress: sample.progress,
              latitude: sample.coordinate[1],
              longitude: sample.coordinate[0],
              bearing: sample.bearing,
              speed,
              routeId: v.routeId,
              isMoving: motionEval.isMoving,
              stoppedReason: motionEval.isMoving ? undefined : motionEval.reasonText,
            };
          }
        } else {
          newMotions[v.internalId] = motion;
        }
      }
      return { motions: newMotions };
    });
  }
}));

if (typeof window !== "undefined") {
  (window as unknown as { __fleetMotionStore?: typeof useFleetMotionStore }).__fleetMotionStore = useFleetMotionStore;
}
