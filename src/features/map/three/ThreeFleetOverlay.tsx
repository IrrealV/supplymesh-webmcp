import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useFleetMotionStore } from "../fleetMotionStore";
import type { DerivedVehicle } from "../layers";

type ThreeFleetOverlayProps = {
  vehicles: readonly DerivedVehicle[];
  active: boolean;
  selectedVehicleId: string;
};

type TruckInstance = {
  currentYaw: number;
  headingGroup: import("three").Group;
  modelGroup: import("three").Group;
  root: import("three").Group;
  selectionMesh: import("three").Mesh;
};

const degreesToRadians = Math.PI / 180;

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function presentationScale(zoom: number, selected: boolean): number {
  const zoomProgress = Math.min(3, Math.max(0, zoom - 14));
  const base = 0.88 + zoomProgress * 0.08;
  return base * (selected ? 1.12 : 1);
}

export function ThreeFleetOverlay({ vehicles, active, selectedVehicleId }: ThreeFleetOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedVehicleRef = useRef(selectedVehicleId);

  useEffect(() => {
    selectedVehicleRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!active) return;

    let isDisposed = false;
    let animationFrameId: number | null = null;
    let resizeHandler: (() => void) | undefined;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").OrthographicCamera | null = null;
    const truckInstances = new Map<string, TruckInstance>();
    const vehicleById = new Map(vehicles.map(({ vehicle }) => [vehicle.internalId, vehicle]));
    const sharedGeometries: import("three").BufferGeometry[] = [];
    const sharedMaterials: import("three").Material[] = [];
    const container = map.getContainer();

    void import("three").then((THREE) => {
      if (isDisposed || canvasRef.current === null) return;

      const canvas = canvasRef.current;
      let width = container.clientWidth;
      let height = container.clientHeight;

      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          canvas,
          powerPreference: "high-performance",
          premultipliedAlpha: true,
        });
      } catch (error) {
        console.warn("Failed to initialize WebGL for ThreeFleetOverlay", error);
        container.dataset.closeRangeRenderer = "2d-fallback";
        return;
      }

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, width, 0, height, -2000, 2000);
      camera.position.set(0, 0, 650);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xf4fbff, 0x24313d, 1.55));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(-180, -220, 420);
      scene.add(keyLight);
      const fillLight = new THREE.DirectionalLight(0x9fd6ff, 0.7);
      fillLight.position.set(220, 120, 180);
      scene.add(fillLight);

      const geometry = {
        bumper: new THREE.BoxGeometry(5, 28, 6),
        cabLower: new THREE.BoxGeometry(25, 27, 18),
        cabUpper: new THREE.BoxGeometry(21, 25, 13),
        chassis: new THREE.BoxGeometry(104, 20, 5),
        doorLine: new THREE.BoxGeometry(1, 25, 19),
        grille: new THREE.BoxGeometry(1.8, 16, 7),
        headlight: new THREE.BoxGeometry(2.1, 4.5, 3.4),
        hub: new THREE.CylinderGeometry(2.2, 2.2, 4.4, 16),
        rearDoor: new THREE.BoxGeometry(1.5, 24, 24),
        roof: new THREE.BoxGeometry(19, 23, 2.2),
        selection: new THREE.RingGeometry(47, 54, 44),
        shadow: new THREE.CircleGeometry(1, 40),
        sideMarker: new THREE.BoxGeometry(3.2, 1.4, 2.1),
        sideWindow: new THREE.BoxGeometry(10, 1.4, 7.5),
        stripe: new THREE.BoxGeometry(63, 1.2, 4),
        trailer: new THREE.BoxGeometry(65, 27, 28),
        trailerRoof: new THREE.BoxGeometry(63, 25, 1.8),
        wheel: new THREE.CylinderGeometry(5.3, 5.3, 4.2, 20),
        windshield: new THREE.BoxGeometry(1.5, 19, 9),
      };
      sharedGeometries.push(...Object.values(geometry));

      const material = {
        cabAttention: new THREE.MeshStandardMaterial({ color: 0xe69016, flatShading: true, metalness: 0.16, roughness: 0.48 }),
        cabCritical: new THREE.MeshStandardMaterial({ color: 0xdd3444, flatShading: true, metalness: 0.16, roughness: 0.48 }),
        cabDriving: new THREE.MeshStandardMaterial({ color: 0x0878c9, flatShading: true, metalness: 0.22, roughness: 0.42 }),
        cabResting: new THREE.MeshStandardMaterial({ color: 0x16835c, flatShading: true, metalness: 0.16, roughness: 0.5 }),
        chassis: new THREE.MeshStandardMaterial({ color: 0x172433, metalness: 0.45, roughness: 0.62 }),
        darkDetail: new THREE.MeshStandardMaterial({ color: 0x101923, metalness: 0.5, roughness: 0.36 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x153b57, emissive: 0x061925, emissiveIntensity: 0.35, metalness: 0.72, roughness: 0.12 }),
        headlight: new THREE.MeshBasicMaterial({ color: 0xffefb0 }),
        hub: new THREE.MeshStandardMaterial({ color: 0x8ea2ae, metalness: 0.72, roughness: 0.25 }),
        outline: new THREE.LineBasicMaterial({ color: 0x142331, transparent: true, opacity: 0.58 }),
        rearDoor: new THREE.MeshStandardMaterial({ color: 0xc7d2da, metalness: 0.18, roughness: 0.5 }),
        selection: new THREE.MeshBasicMaterial({ color: 0x2687e8, depthWrite: false, opacity: 0.5, side: THREE.DoubleSide, transparent: true }),
        shadow: new THREE.MeshBasicMaterial({ color: 0x06111a, depthWrite: false, opacity: 0.26, side: THREE.DoubleSide, transparent: true }),
        stripe: new THREE.MeshStandardMaterial({ color: 0x2182ce, metalness: 0.12, roughness: 0.45 }),
        trailer: new THREE.MeshStandardMaterial({ color: 0xe8eef2, flatShading: true, metalness: 0.18, roughness: 0.42 }),
        trailerRoof: new THREE.MeshStandardMaterial({ color: 0xf8fbfc, metalness: 0.08, roughness: 0.32 }),
        warningLight: new THREE.MeshBasicMaterial({ color: 0xffa424 }),
        wheel: new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.08, roughness: 0.92 }),
      };
      sharedMaterials.push(...Object.values(material));

      const edgeGeometry = {
        cabLower: new THREE.EdgesGeometry(geometry.cabLower, 28),
        cabUpper: new THREE.EdgesGeometry(geometry.cabUpper, 28),
        trailer: new THREE.EdgesGeometry(geometry.trailer, 28),
      };
      sharedGeometries.push(...Object.values(edgeGeometry));

      const addMesh = (
        parent: import("three").Object3D,
        meshGeometry: import("three").BufferGeometry,
        meshMaterial: import("three").Material,
        position: readonly [number, number, number],
      ): import("three").Mesh => {
        const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
        mesh.position.set(...position);
        parent.add(mesh);
        return mesh;
      };

      const addEdges = (
        parent: import("three").Object3D,
        edges: import("three").EdgesGeometry,
        position: readonly [number, number, number],
      ): void => {
        const line = new THREE.LineSegments(edges, material.outline);
        line.position.set(...position);
        line.renderOrder = 3;
        parent.add(line);
      };

      const cabMaterial = (status: string): import("three").MeshStandardMaterial => {
        if (status === "critical") return material.cabCritical;
        if (status === "needs-attention") return material.cabAttention;
        if (status === "resting") return material.cabResting;
        return material.cabDriving;
      };

      const createTruck = (vehicleId: string, status: string): TruckInstance => {
        const root = new THREE.Group();
        root.name = `truck-${vehicleId}`;

        const shadowMesh = addMesh(root, geometry.shadow, material.shadow, [0, 5, -18]);
        shadowMesh.scale.set(59, 18, 1);
        shadowMesh.renderOrder = 0;

        const selectionMesh = addMesh(root, geometry.selection, material.selection, [0, 4, -16]);
        selectionMesh.visible = false;
        selectionMesh.renderOrder = 1;

        const headingGroup = new THREE.Group();
        root.add(headingGroup);

        const modelGroup = new THREE.Group();
        modelGroup.rotation.x = -52 * degreesToRadians;
        modelGroup.position.y = -4;
        headingGroup.add(modelGroup);

        addMesh(modelGroup, geometry.chassis, material.chassis, [-2, 0, 7]);
        addMesh(modelGroup, geometry.trailer, material.trailer, [-18, 0, 23]);
        addMesh(modelGroup, geometry.trailerRoof, material.trailerRoof, [-18, 0, 37.3]);
        addMesh(modelGroup, geometry.rearDoor, material.rearDoor, [-51.2, 0, 23]);
        addMesh(modelGroup, geometry.stripe, material.stripe, [-18, -14.1, 22]);
        addMesh(modelGroup, geometry.stripe, material.stripe, [-18, 14.1, 22]);
        addEdges(modelGroup, edgeGeometry.trailer, [-18, 0, 23]);

        addMesh(modelGroup, geometry.cabLower, cabMaterial(status), [33, 0, 17]);
        addMesh(modelGroup, geometry.cabUpper, cabMaterial(status), [31, 0, 31.5]);
        addMesh(modelGroup, geometry.roof, material.trailerRoof, [31, 0, 39]);
        addMesh(modelGroup, geometry.bumper, material.chassis, [47.3, 0, 8.5]);
        addMesh(modelGroup, geometry.windshield, material.glass, [42, 0, 31.5]);
        addMesh(modelGroup, geometry.sideWindow, material.glass, [34, -13, 31.5]);
        addMesh(modelGroup, geometry.sideWindow, material.glass, [34, 13, 31.5]);
        addMesh(modelGroup, geometry.grille, material.darkDetail, [47.6, 0, 17]);
        addMesh(modelGroup, geometry.headlight, material.headlight, [48.1, -8, 13]);
        addMesh(modelGroup, geometry.headlight, material.headlight, [48.1, 8, 13]);
        addMesh(modelGroup, geometry.doorLine, material.darkDetail, [20.3, 0, 18]);
        addEdges(modelGroup, edgeGeometry.cabLower, [33, 0, 17]);
        addEdges(modelGroup, edgeGeometry.cabUpper, [31, 0, 31.5]);

        for (const y of [-14.6, 14.6]) {
          for (const x of [34, 10, -28, -43]) {
            addMesh(modelGroup, geometry.wheel, material.wheel, [x, y, 6]);
            addMesh(modelGroup, geometry.hub, material.hub, [x, y + (y < 0 ? -2.2 : 2.2), 6]);
          }
          for (const x of [-8, -28]) addMesh(modelGroup, geometry.sideMarker, material.warningLight, [x, y + (y < 0 ? -0.8 : 0.8), 14]);
        }

        scene!.add(root);
        return { currentYaw: 0, headingGroup, modelGroup, root, selectionMesh };
      };

      for (const { vehicle } of vehicles) truckInstances.set(vehicle.internalId, createTruck(vehicle.internalId, vehicle.status));

      resizeHandler = (): void => {
        if (renderer === null || camera === null || isDisposed) return;
        const nextWidth = container.clientWidth;
        const nextHeight = container.clientHeight;
        if (nextWidth === width && nextHeight === height) return;
        width = nextWidth;
        height = nextHeight;
        renderer.setSize(width, height, false);
        camera.right = width;
        camera.bottom = height;
        camera.updateProjectionMatrix();
      };
      map.on("resize", resizeHandler);

      const renderFrame = (): void => {
        if (isDisposed || renderer === null || scene === null || camera === null) return;

        const motions = useFleetMotionStore.getState().motions;
        const selectedId = selectedVehicleRef.current;
        const zoom = map.getZoom();
        let visibleCount = 0;

        for (const [vehicleId, instance] of truckInstances) {
          const vehicle = vehicleById.get(vehicleId);
          if (vehicle === undefined) {
            instance.root.visible = false;
            continue;
          }

          const motion = motions[vehicleId];
          const [fallbackLongitude, fallbackLatitude] = vehicle.position.geometry.coordinates;
          const latitude = motion?.latitude ?? fallbackLatitude;
          const longitude = motion?.longitude ?? fallbackLongitude;
          const bearing = motion?.bearing ?? 0;
          if (![latitude, longitude, bearing].every(Number.isFinite)) {
            instance.root.visible = false;
            continue;
          }

          const point = map.latLngToContainerPoint([latitude, longitude]);
          const margin = 145;
          if (point.x < -margin || point.x > width + margin || point.y < -margin || point.y > height + margin) {
            instance.root.visible = false;
            continue;
          }

          visibleCount += 1;
          const selected = vehicleId === selectedId;
          const scale = presentationScale(zoom, selected);
          instance.root.visible = true;
          instance.root.position.set(point.x, point.y + 5, selected ? 30 : 0);
          instance.root.scale.setScalar(scale);
          instance.selectionMesh.visible = selected;

          const targetYaw = normalizeAngle((bearing - 90) * degreesToRadians);
          const difference = normalizeAngle(targetYaw - instance.currentYaw);
          instance.currentYaw = normalizeAngle(instance.currentYaw + difference * 0.24);
          instance.headingGroup.rotation.z = instance.currentYaw;
        }

        canvas.dataset.threeVisibleTrucks = String(visibleCount);
        canvas.dataset.threeMotionRecords = String(Object.keys(motions).length);
        canvas.dataset.threeZoom = zoom.toFixed(2);
        container.dataset.threeModel = "volumetric-v2";
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(renderFrame);
      };

      animationFrameId = requestAnimationFrame(renderFrame);
    });

    return () => {
      isDisposed = true;
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      if (resizeHandler !== undefined) map.off("resize", resizeHandler);
      truckInstances.forEach(({ root }) => root.clear());
      truckInstances.clear();
      sharedGeometries.forEach((geometry) => geometry.dispose());
      sharedMaterials.forEach((material) => material.dispose());
      scene?.clear();
      renderer?.dispose();
      renderer?.forceContextLoss();
      delete container.dataset.threeModel;
    };
  }, [active, map, vehicles]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="threejs-fleet-canvas"
      data-three-canvas="shared"
      data-three-model="volumetric-v2"
      style={{
        height: "100%",
        left: 0,
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        width: "100%",
        zIndex: 645,
      }}
    />
  );
}
