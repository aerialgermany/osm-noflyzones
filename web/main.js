
const map = L.map('map').setView([50.1, 8.2], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.control.scale({ metric: true }).addTo(map);

let fullData = null;
let currentLayer = null;

const layerColors = {
  aeroway: "#2b83ba",
  landuse: "#d7191c",
  amenity: "#fdae61",
  boundary: "#33aa33",
  highway: "#ff9900",
  railway: "#8e44ad",
  waterway: "#3498db"
};

const checkboxes = document.querySelectorAll('#sidebar input[type="checkbox"]');

function filterData(selected, bounds = null) {
  const features = fullData.features
    .filter(f => {
      const p = f.properties;
      const match = selected.some(cat =>
        (cat === "aeroway" && p.aeroway === 'aerodrome') ||
        (cat === "landuse" && p.landuse === 'military') ||
        (cat === "amenity" && p.amenity === 'prison') ||
        (cat === "boundary" && p.boundary === 'protected_area') ||
        (cat === "highway" && ["motorway", "trunk", "primary"].includes(p.highway)) ||
        (cat === "railway" && ["rail", "subway", "light_rail"].includes(p.railway)) ||
        (cat === "waterway" && ["river", "canal"].includes(p.waterway))
      );
      if (!match) return false;
      if (bounds) {
        const geo = L.geoJSON(f);
        return map.getBounds().intersects(geo.getBounds());
      }
      return true;
    })
    .map(f => {
      const p = f.properties;
      const needsBuffer =
        (["motorway", "trunk", "primary"].includes(p.highway) ||
         ["rail", "subway", "light_rail"].includes(p.railway) ||
         ["river", "canal"].includes(p.waterway));

      if (needsBuffer && f.geometry.type === "LineString") {
        try {
            const bufferMeters = parseFloat(document.getElementById('bufferWidth').value) || 0;
            const bufferKm = bufferMeters / 1000;
            const buffered = turf.buffer(f, bufferKm, { units: 'kilometers' });
          return {
            type: "Feature",
            geometry: buffered.geometry,
            properties: f.properties
          };
        } catch (e) {
          console.warn("Buffer failed:", e);
        }
      }

      return f;
    });

  return { type: "FeatureCollection", features };
}

function renderGeoJSON(filtered) {
  if (currentLayer) map.removeLayer(currentLayer);

  currentLayer = L.geoJSON(filtered, {
    style: feature => {
      const p = feature.properties;
      if (p.aeroway === "aerodrome") return { color: layerColors.aeroway, weight: 2, fillOpacity: 0.4 };
      if (p.landuse === "military") return { color: layerColors.landuse, weight: 2, fillOpacity: 0.4 };
      if (p.amenity === "prison") return { color: layerColors.amenity, weight: 2, fillOpacity: 0.4 };
      if (p.boundary === "protected_area") return { color: layerColors.boundary, weight: 2, fillOpacity: 0.4 };
      if (["motorway", "trunk", "primary"].includes(p.highway)) return { color: layerColors.highway, weight: 1, fillOpacity: 0.3 };
      if (["rail", "subway", "light_rail"].includes(p.railway)) return { color: layerColors.railway, weight: 1, fillOpacity: 0.3 };
      if (["river", "canal"].includes(p.waterway)) return { color: layerColors.waterway, weight: 1, fillOpacity: 0.3 };
      return { color: "orange", weight: 1, fillOpacity: 0.2 };
    },
    onEachFeature: (feature, layer) => {
      const tags = Object.entries(feature.properties).map(([k, v]) => `<b>${k}</b>: ${v}`).join("<br>");
      layer.bindPopup(tags || "No metadata");
    }
  }).addTo(map);
}

checkboxes.forEach(cb => cb.addEventListener('change', updateMap));

function updateMap() {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const filtered = filterData(selected);
  renderGeoJSON(filtered);
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const bounds = map.getBounds();
  const filtered = filterData(selected, bounds);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filtered));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "no_fly_filtered.geojson");
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
});

document.getElementById('downloadKmlBtn').addEventListener('click', () => {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const bounds = map.getBounds();
  const filtered = filterData(selected, bounds);

  const kmlString = tokml(filtered, {
    name: 'name',
    description: 'description'
  });

  const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", url);
  dlAnchor.setAttribute("download", "no_fly_filtered.kml");
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
});

function normalizeLongitude(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

document.getElementById('updateBtn').addEventListener('click', () => {
  const bounds = map.getBounds();
  const latLng1 = bounds.getSouthWest();
  const latLng2 = bounds.getNorthEast();
  const minLon = normalizeLongitude(latLng1.lng);
  const maxLon = normalizeLongitude(latLng2.lng);
  const R = 6371;
  const lat1 = latLng1.lat * Math.PI / 180;
  const lat2 = latLng2.lat * Math.PI / 180;
  const dLon = (maxLon - minLon) * Math.PI / 180;
  const a = Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
  const widthKm = 2 * R * Math.asin(Math.sqrt(a));
  if (widthKm > 200) {
    alert("The map view is too wide (> 200 km). Please zoom in.");
    return;
  }

  const url = `/generate-geojson?min_lat=${latLng1.lat}&min_lon=${minLon}&max_lat=${latLng2.lat}&max_lon=${maxLon}`;
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("Request rejected by server.");
      return res.json();
    })
    .then(data => {
      fullData = data;
      updateMap();
    })
    .catch(err => {
      console.error("Error loading data:", err);
      alert("Error loading GeoJSON.");
    });
});

document.addEventListener("DOMContentLoaded", () => {
  const locationInput = document.getElementById("locationSearch");

  if (locationInput) {
    locationInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = e.target.value;
        if (!query) return;

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

        fetch(url)
          .then(res => res.json())
          .then(data => {
            if (!data.length) {
              alert("Location not found.");
              return;
            }
            const { lat, lon } = data[0];
            map.setView([parseFloat(lat), parseFloat(lon)], 13);
          })
          .catch(err => {
            console.error("Geocoding error:", err);
            alert("Could not locate the place.");
          });
      }
    });
  } else {
    console.error("locationSearch input field not found.");
  }
});
