const map = L.map('map').setView([50.1, 8.2], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap-Participants'
}).addTo(map);

// Show scale
L.control.scale({ metric: true }).addTo(map);

let fullData = null;
let currentLayer = null;

const layerColors = {
  aeroway: "#2b83ba",     // Blue
  landuse: "#d7191c",     // Red
  amenity: "#fdae61",     // Orange
  boundary: "#33aa33"     // Green
};

const checkboxes = document.querySelectorAll('#sidebar input[type="checkbox"]');

function filterData(selected) {
  return {
    type: "FeatureCollection",
    features: fullData.features.filter(f => {
      const p = f.properties;
      return selected.some(cat =>
        (cat === "aeroway" && p.aeroway === 'aerodrome') ||
        (cat === "landuse" && p.landuse === 'military') ||
        (cat === "amenity" && p.amenity === 'prison') ||
        (cat === "boundary" && p.boundary === 'protected_area')
      );
    })
  };
}

function renderGeoJSON(filtered) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = L.geoJSON(filtered, {
    style: feature => {
      const props = feature.properties;
      for (const key in layerColors) {
        if (props[key]) return { color: layerColors[key], weight: 2, fillOpacity: 0.4 };
      }
      return { color: 'orange' };
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      const tags = Object.entries(props).map(([k, v]) => `<b>${k}</b>: ${v}`).join('<br>');
      layer.bindPopup(tags || "No Metadata");
    }
  }).addTo(map);
}

// Init
fetch('no_fly_zones_final.geojson')
  .then(res => res.json())
  .then(data => {
    fullData = data;
    updateMap();
  });

// Checkbox-Logic
checkboxes.forEach(cb => cb.addEventListener('change', updateMap));

function updateMap() {
  const selected = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  const filtered = filterData(selected);
  renderGeoJSON(filtered);
}

// Download-Button
document.getElementById('downloadBtn').addEventListener('click', () => {
  const selected = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filterData(selected)));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "no_fly_filtered.geojson");
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
});

let currentGeoJSON = null;

document.getElementById('updateBtn').addEventListener('click', () => {
  const bounds = map.getBounds();
  const latLng1 = bounds.getSouthWest();
  const latLng2 = bounds.getNorthEast();

  // Estimate distance in km (only width)
  const R = 6371; // Earth radius in km
  const lat1 = latLng1.lat * Math.PI / 180;
  const lat2 = latLng2.lat * Math.PI / 180;
  const dLon = (latLng2.lng - latLng1.lng) * Math.PI / 180;
  const a = Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
  const widthKm = 2 * R * Math.asin(Math.sqrt(a));

  if (widthKm > 200) {
    alert("The map view is too wide (> 200 km). Zoome closer, please.");
    return;
  }

  const url = `/generate-geojson?min_lat=${latLng1.lat}&min_lon=${latLng1.lng}&max_lat=${latLng2.lat}&max_lon=${latLng2.lng}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("Server has denied the request.");
      return res.json();
    })
    .then(data => {
      fullData = data;
      updateMap();
    })
    .catch(err => {
      console.error("Error on load:", err);
      alert("Error on load of data.");
    });
});
