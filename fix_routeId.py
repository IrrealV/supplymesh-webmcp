with open('src/features/map/VehicleMarkerLayer.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'model.style.setProperty("--close-range-bearing", `${motion.bearing - 63}deg`);',
    'model.style.setProperty("--close-range-bearing", `${motion.bearing - 63}deg`);\n          model.dataset.closeRangeRouteId = motion.routeId;'
)

with open('src/features/map/VehicleMarkerLayer.tsx', 'w') as f:
    f.write(content)
