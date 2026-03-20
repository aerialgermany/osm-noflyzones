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
  waterway: "#3498db",
  power: "#e75480",
  windturbine: "#90ee90",
  windturbine_buffer: "#006400"
};

function showLoading() {
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

const checkboxes = document.querySelectorAll('.category-checkbox');
const zensusDensityClassSelect = document.getElementById('zensusDensityClass');
const zensusMinDensityInput = document.getElementById('zensusMinDensity');

const zensusClassThresholds = {
  very_low: 100,
  low: 400,
  medium: 1000,
  high: 2000
};

function getSelectedZensusThreshold() {
  const selectedClass = zensusDensityClassSelect ? zensusDensityClassSelect.value : "custom";
  if (selectedClass === "custom") {
    const customMin = parseFloat(zensusMinDensityInput?.value || "0");
    return Number.isFinite(customMin) ? Math.max(customMin, 0) : 0;
  }
  return zensusClassThresholds[selectedClass] ?? zensusClassThresholds.low;
}

function syncZensusControls() {
  const isCustom = zensusDensityClassSelect && zensusDensityClassSelect.value === "custom";
  if (zensusMinDensityInput) {
    zensusMinDensityInput.disabled = !isCustom;
  }
}

function getZensusColor(density) {
  if (density === null || density === undefined) return "#f4f4f4";
  if (density >= 8000) return "#7f0000";
  if (density >= 4000) return "#b30000";
  if (density >= 2000) return "#d7301f";
  if (density >= 1000) return "#ef6548";
  if (density >= 500) return "#fc8d59";
  if (density >= 100) return "#fdbb84";
  return "#fee8c8";
}

function getLegacyCategory(p) {
  if (p.aeroway === "aerodrome") return "aeroway";
  if (p.landuse === "military") return "landuse";
  if (p.amenity === "prison") return "amenity";
  if (p.boundary === "protected_area") return "boundary";
  if (["motorway", "trunk", "primary"].includes(p.highway)) return "highway";
  if (["rail", "subway", "light_rail"].includes(p.railway)) return "railway";
  if (["river", "canal"].includes(p.waterway)) return "waterway";
  if (p.power === "line") return "power";
  if (p.power === "generator" && p["generator:source"] === "wind") return "windturbine";
  return null;
}

function getFeatureCategory(properties) {
  return properties.category || getLegacyCategory(properties);
}

function needsBuffer(category) {
  return ["highway", "railway", "waterway", "power", "windturbine"].includes(category);
}

function filterData(selected, bounds = null) {
  if (!fullData || !fullData.features) {
    return { type: "FeatureCollection", features: [] };
  }

  const features = fullData.features
    .filter(f => {
      const p = f.properties;
      const category = getFeatureCategory(p);
      if (category === "zensus_density") {
        const density = p.metrics ? p.metrics.density_km2 : null;
        const threshold = getSelectedZensusThreshold();
        if (density === null || density === undefined) return false;
        if (density < threshold) return false;
      }
      const match = selected.includes(category);
      if (!match) return false;

      if (bounds) {
        const geo = L.geoJSON(f);
        return bounds.intersects(geo.getBounds());
      }
      return true;
    })
    .map(f => {
      const p = f.properties;
      const category = getFeatureCategory(p);
      const isWindTurbine = category === "windturbine";
      const shouldBuffer = needsBuffer(category);
      const bufferMeters = isWindTurbine ? 50 : parseFloat(document.getElementById('bufferWidth').value) || 0;

      const results = [f];

      if (shouldBuffer && bufferMeters > 0) {
        try {
          const bufferKm = bufferMeters / 1000;
          const buffered = turf.buffer(f, bufferKm, { units: 'kilometers' });
          buffered.properties = { ...f.properties, buffered: true };
          results.push(buffered);
        } catch (e) {
          console.warn("Buffer failed:", e);
        }
      }

      return results;
    })
    .flat();

  return { type: "FeatureCollection", features };
}

function renderGeoJSON(filtered) {
  if (currentLayer) map.removeLayer(currentLayer);

  currentLayer = L.geoJSON(filtered, {
    style: feature => {
      const p = feature.properties;
      const category = getFeatureCategory(p);
      const density = p.metrics ? p.metrics.density_km2 : null;

      if (p.buffered && category === "windturbine") {
        return { color: layerColors.windturbine_buffer, weight: 1, fillOpacity: 0.3 };
      }

      if (category === "zensus_density") {
        return {
          color: "#7b1f1f",
          weight: 0.5,
          fillColor: getZensusColor(density),
          fillOpacity: 0.45
        };
      }
      if (category === "aeroway") return { color: layerColors.aeroway, weight: 2, fillOpacity: 0.4 };
      if (category === "landuse") return { color: layerColors.landuse, weight: 2, fillOpacity: 0.4 };
      if (category === "amenity") return { color: layerColors.amenity, weight: 2, fillOpacity: 0.4 };
      if (category === "boundary") return { color: layerColors.boundary, weight: 2, fillOpacity: 0.4 };
      if (category === "highway") return { color: layerColors.highway, weight: 1, fillOpacity: 0.3 };
      if (category === "railway") return { color: layerColors.railway, weight: 1, fillOpacity: 0.3 };
      if (category === "waterway") return { color: layerColors.waterway, weight: 1, fillOpacity: 0.3 };
      if (category === "power") return { color: layerColors.power, weight: 1, fillOpacity: 0.3 };
      if (category === "windturbine") return { color: layerColors.windturbine, weight: 1, fillOpacity: 0.7 };

      return { color: "orange", weight: 1, fillOpacity: 0.2 };
    },
    pointToLayer: (feature, latlng) => {
      const p = feature.properties;
      const category = getFeatureCategory(p);
      if (category === "windturbine" && !p.buffered) {
        return L.circleMarker(latlng, {
          radius: 5,
          fillColor: layerColors.windturbine,
          color: "#333",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
      }
      return L.marker(latlng);
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const lines = [];

      if (p.source) lines.push(`<b>source</b>: ${p.source}`);
      if (p.category) lines.push(`<b>category</b>: ${p.category}`);
      if (p.subcategory) lines.push(`<b>subcategory</b>: ${p.subcategory}`);

      if (p.metrics) {
        if (p.metrics.einwohner !== null && p.metrics.einwohner !== undefined) {
          lines.push(`<b>Einwohner</b>: ${p.metrics.einwohner}`);
        }
        if (p.metrics.density_km2 !== null && p.metrics.density_km2 !== undefined) {
          lines.push(`<b>Density (people/km²)</b>: ${p.metrics.density_km2}`);
        }
      }

      if (p.raw && typeof p.raw === "object") {
        for (const [k, v] of Object.entries(p.raw)) {
          lines.push(`<b>${k}</b>: ${v}`);
        }
      }

      const tags = lines.join("<br>");
      layer.bindPopup(tags || "No metadata");
    }
  }).addTo(map);
}

checkboxes.forEach(cb => cb.addEventListener('change', updateMap));
if (zensusDensityClassSelect) {
  zensusDensityClassSelect.addEventListener('change', () => {
    syncZensusControls();
    updateMap();
  });
}
if (zensusMinDensityInput) {
  zensusMinDensityInput.addEventListener('change', updateMap);
}
syncZensusControls();

function updateMap() {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const filtered = filterData(selected);
  renderGeoJSON(filtered);
}

function buildRequestUrl(bounds) {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const includeZensus = selected.includes("zensus_density");
  const grid = document.getElementById("zensusGrid").value;
  // Always load full zensus data for current extent.
  // Thresholding is applied client-side so lower thresholds only add areas.
  const minDensity = 0;

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const minLon = normalizeLongitude(sw.lng);
  const maxLon = normalizeLongitude(ne.lng);

  const params = new URLSearchParams({
    min_lat: sw.lat.toString(),
    min_lon: minLon.toString(),
    max_lat: ne.lat.toString(),
    max_lon: maxLon.toString(),
    include_osm: "true",
    include_zensus: includeZensus ? "true" : "false",
    zensus_grid: grid,
    zensus_min_density: minDensity.toString()
  });

  return `/generate-geojson?${params.toString()}`;
}

function isPolygonGeometry(geometry) {
  return geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon");
}

function mergeZensusExportFeatures(features) {
  const zensusPolygons = features.filter(f => {
    const category = getFeatureCategory(f.properties || {});
    return category === "zensus_density" && !f.properties?.buffered && isPolygonGeometry(f.geometry);
  });

  if (zensusPolygons.length === 0) {
    return features;
  }

  let merged = JSON.parse(JSON.stringify(zensusPolygons[0]));
  const leftovers = [];

  for (let i = 1; i < zensusPolygons.length; i += 1) {
    try {
      const next = zensusPolygons[i];
      const unionResult = turf.union(merged, next);
      if (unionResult && unionResult.geometry) {
        merged = unionResult;
      } else {
        leftovers.push(next);
      }
    } catch (err) {
      console.warn("Zensus union failed for one feature, keeping it separate.", err);
      leftovers.push(zensusPolygons[i]);
    }
  }

  const sourceProps = zensusPolygons[0].properties || {};
  merged.properties = {
    ...sourceProps,
    merged_cells: zensusPolygons.length,
    export_note: "Adjacent zensus cells merged for export"
  };

  const nonZensus = features.filter(f => getFeatureCategory(f.properties || {}) !== "zensus_density");
  return [...nonZensus, merged, ...leftovers];
}

function buildExportData(selected, bounds) {
  const filtered = filterData(selected, bounds);
  return {
    type: "FeatureCollection",
    features: mergeZensusExportFeatures(filtered.features || [])
  };
}

document.getElementById('downloadBtn').addEventListener('click', () => {
  const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
  const bounds = map.getBounds();
  const exportData = buildExportData(selected, bounds);
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
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
  const exportData = buildExportData(selected, bounds);

  const kmlString = tokml(exportData, {
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

  const url = buildRequestUrl(bounds);
  showLoading();

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("Request rejected by server.");
      return res.json();
    })
    .then(data => {
      fullData = data;
      updateMap();
      hideLoading();
    })
    .catch(err => {
      console.error("Error loading data:", err);
      alert("Error loading GeoJSON.");
      hideLoading();
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
