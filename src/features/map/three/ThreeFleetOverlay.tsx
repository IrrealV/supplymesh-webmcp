import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useFleetMotionStore } from "../fleetMotionStore";
import type { DerivedVehicle } from "../layers";

type ThreeFleetOverlayProps = {
  vehicles: readonly DerivedVehicle[];
  active: boolean;
  selectedVehicleId: string;
};

export function ThreeFleetOverlay({ vehicles, active, selectedVehicleId }: ThreeFleetOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    let isDisposed = false;
    let animFrameId: number | null = null;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").OrthographicCamera | null = null;

    // Track meshes per vehicle
    type TruckInstance = {
      root: import("three").Group;
      pitchGroup: import("three").Group;
      yawGroup: import("three").Group;
      cabMesh: import("three").Mesh;
      trailerMesh: import("three").Mesh;
      chassisMesh: import("three").Mesh;
      wheels: import("three").Mesh[];
      shadowMesh: import("three").Mesh;
      selectionMesh: import("three").Mesh;
    };

    const truckInstances = new Map<string, TruckInstance>();
    const sharedGeometries: import("three").BufferGeometry[] = [];
    const sharedMaterials: import("three").Material[] = [];

    // Dynamically import Three.js only when close-range is active (zoom >= 14)
    import("three").then((THREE) => {
      if (isDisposed || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const container = map.getContainer();
      let width = container.clientWidth;
      let height = container.clientHeight;

      // Single WebGL renderer for all vehicles
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      } catch (err) {
        console.warn("Failed to initialize WebGL for ThreeFleetOverlay", err);
        return;
      }

      scene = new THREE.Scene();

      // Orthographic camera mapping 1:1 to container pixels
      camera = new THREE.OrthographicCamera(0, width, 0, height, -2000, 2000);
      camera.position.set(0, 0, 500);
      camera.lookAt(0, 0, 0);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
      directionalLight.position.set(-150, -200, 350);
      scene.add(directionalLight);

      // Shared Geometries
      const cabGeo = new THREE.BoxGeometry(18, 20, 18);
      const trailerGeo = new THREE.BoxGeometry(46, 20, 22);
      const chassisGeo = new THREE.BoxGeometry(70, 18, 5);
      const wheelGeo = new THREE.CylinderGeometry(4.5, 4.5, 3.5, 12);
      const shadowGeo = new THREE.PlaneGeometry(76, 28);
      const windshieldGeo = new THREE.BoxGeometry(3, 16, 9);
      const selectionGeo = new THREE.PlaneGeometry(86, 36);

      sharedGeometries.push(cabGeo, trailerGeo, chassisGeo, wheelGeo, shadowGeo, windshieldGeo, selectionGeo);

      // Shared Materials
      const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.2 });
      const cabMatDefault = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.3 });
      const cabMatCritical = new THREE.MeshStandardMaterial({ color: 0xd9383a, roughness: 0.3, metalness: 0.3 });
      const cabMatAttention = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.3 });
      const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      const windshieldMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8 });
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
      const selectionMat = new THREE.MeshBasicMaterial({ color: 0x2563a6, transparent: true, opacity: 0.35 });

      sharedMaterials.push(
        trailerMat,
        cabMatDefault,
        cabMatCritical,
        cabMatAttention,
        chassisMat,
        wheelMat,
        windshieldMat,
        shadowMat,
        selectionMat
      );

      // Function to create one truck group
      function createTruck(vehicleId: string, status: string): TruckInstance {
        const root = new THREE.Group();
        root.name = `truck-${vehicleId}`;

        const pitchGroup = new THREE.Group();
        // Fixed isometric downward pitch of 55 degrees
        pitchGroup.rotation.x = -55 * (Math.PI / 180);
        root.add(pitchGroup);

        const yawGroup = new THREE.Group();
        pitchGroup.add(yawGroup);

        // Ground shadow
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.position.set(0, 0, 0.2);
        yawGroup.add(shadowMesh);

        // Selection highlight ring
        const selectionMesh = new THREE.Mesh(selectionGeo, selectionMat);
        selectionMesh.position.set(0, 0, 0.1);
        selectionMesh.visible = false;
        yawGroup.add(selectionMesh);

        // Wheels: 4 wheel positions
        const wheelPositions = [
          [24, -9.5, 4.5],
          [24, 9.5, 4.5],
          [10, -9.5, 4.5],
          [10, 9.5, 4.5],
          [-14, -9.5, 4.5],
          [-14, 9.5, 4.5],
          [-28, -9.5, 4.5],
          [-28, 9.5, 4.5],
        ];

        const wheels: import("three").Mesh[] = [];
        for (const [wx, wy, wz] of wheelPositions) {
          const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
          wMesh.position.set(wx, wy, wz);
          wMesh.rotation.x = Math.PI / 2;
          yawGroup.add(wMesh);
          wheels.push(wMesh);
        }

        // Chassis
        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        chassisMesh.position.set(0, 0, 6);
        yawGroup.add(chassisMesh);

        // Trailer
        const trailerMesh = new THREE.Mesh(trailerGeo, trailerMat);
        trailerMesh.position.set(-11, 0, 18);
        yawGroup.add(trailerMesh);

        // Cab
        const cabColorMat = status === "critical" ? cabMatCritical : status === "needs-attention" ? cabMatAttention : cabMatDefault;
        const cabMesh = new THREE.Mesh(cabGeo, cabColorMat);
        cabMesh.position.set(24, 0, 16);
        yawGroup.add(cabMesh);

        // Windshield
        const windshieldMesh = new THREE.Mesh(windshieldGeo, windshieldMat);
        windshieldMesh.position.set(32, 0, 19);
        yawGroup.add(windshieldMesh);

        scene!.add(root);

        return {
          root,
          pitchGroup,
          yawGroup,
          cabMesh,
          trailerMesh,
          chassisMesh,
          wheels,
          shadowMesh,
          selectionMesh,
        };
      }

      // Sync truck instances with scenario vehicles
      for (const v of vehicles) {
        const truck = createTruck(v.vehicle.internalId, v.vehicle.status);
        truckInstances.set(v.vehicle.internalId, truck);
      }

      // Resize handler
      const handleResize = () => {
        if (!renderer || !camera || isDisposed) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if (newW !== width || newH !== height) {
          width = newW;
          height = newH;
          renderer.setSize(width, height, false);
          camera.right = width;
          camera.bottom = height;
          camera.updateProjectionMatrix();
        }
      };

      map.on("resize", handleResize);

      // Animation render loop
      const renderFrame = () => {
        if (isDisposed || !renderer || !scene || !camera) return;

        const motions = useFleetMotionStore.getState().motions;
        const currentSelectedId = selectedVehicleId;

        for (const [vehicleId, instance] of truckInstances) {
          const motion = motions[vehicleId];
          if (!motion) {
            instance.root.visible = false;
            continue;
          }

          // Project Leaflet lat/lng to container pixel coordinates
          const pt = map.latLngToContainerPoint([motion.latitude, motion.longitude]);

          // Render only within viewport
          const margin = 90;
          if (pt.x < -margin || pt.x > width + margin || pt.y < -margin || pt.y > height + margin) {
            instance.root.visible = false;
            continue;
          }

          instance.root.visible = true;
          instance.root.position.set(pt.x, pt.y, 0);

          // Apply bearing as yaw only (no pitch or roll on the truck!)
          // Bearing 0 = North (up, -Y in screen coordinates)
          // Bearing 90 = East (right, +X in screen coordinates)
          const yawRad = -((motion.bearing - 90) * (Math.PI / 180));
          instance.yawGroup.rotation.z = yawRad;

          // Selection aura
          instance.selectionMesh.visible = vehicleId === currentSelectedId;
        }

        renderer.render(scene, camera);
        animFrameId = requestAnimationFrame(renderFrame);
      };

      animFrameId = requestAnimationFrame(renderFrame);
    });

    return () => {
      isDisposed = true;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
      }

      // Dispose all Three.js resources
      for (const instance of truckInstances.values()) {
        instance.root.clear();
      }
      truckInstances.clear();

      for (const geo of sharedGeometries) {
        geo.dispose();
      }
      for (const mat of sharedMaterials) {
        mat.dispose();
      }

      if (scene) {
        scene.clear();
      }

      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }, [active, map, vehicles, selectedVehicleId]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="threejs-fleet-canvas"
      data-three-canvas="shared"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 645,
      }}
    />
  );
}
