function RegionFramer({ regionId }: { regionId: string }) {
  const map = useMap();
  useEffect(() => {
    if (regionId === "france-v1") map.setView([45.75, 3.5], 6.5);
    else if (regionId === "germany-v1") map.setView([51.16, 10.45], 6.5);
    else map.setView([40.1, -3.55], 6.5);
  }, [regionId, map]);
  return null;
}
function AvoidanceAreaLayer() {
  const area = useUiCoordinationStore(state => state.avoidanceArea);
  if (!area) return null;
  return (
    <Pane name="avoidance-area" style={{ zIndex: 610 }}>
      <Circle center={[area.coordinates[1], area.coordinates[0]]} radius={area.radiusMeters} pathOptions={{ color: 'red', fillColor: '#ff0000', fillOpacity: 0.2 }} />
    </Pane>
  );
}
