import json
from math import radians, sin, cos, sqrt, asin
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import geojson
import overpy
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return RedirectResponse(url="/web/index.html")

app.mount("/web", StaticFiles(directory="web", html=True), name="web")

ZENSUS_FEATURE_SERVICE = (
    "https://services2.arcgis.com/jUpNdisbWqRpMo35/arcgis/rest/services/"
    "Zensus2022_grid_final/FeatureServer"
)
ZENSUS_GRID_LAYER_MAP = {"100m": 0, "1km": 1, "10km": 2}
ZENSUS_GRID_AREA_KM2 = {"100m": 0.01, "1km": 1.0, "10km": 100.0}

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)
    a = cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    return 2 * R * asin(sqrt(a))

def fetch_json(url: str, params: dict):
    query_string = urlencode(params, doseq=True)
    final_url = f"{url}?{query_string}"
    try:
        with urlopen(final_url, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError(f"Request failed for {url}: {exc}") from exc


def normalize_osm_properties(tags: dict):
    category = None
    subcategory = None
    buffer_default_m = 0

    if tags.get("aeroway") == "aerodrome":
        category = "aeroway"
        subcategory = "airport"
    elif tags.get("landuse") == "military":
        category = "landuse"
        subcategory = "military"
    elif tags.get("amenity") == "prison":
        category = "amenity"
        subcategory = "prison"
    elif tags.get("boundary") == "protected_area":
        category = "boundary"
        subcategory = "protected_area"
    elif tags.get("highway") in {"motorway", "trunk", "primary"}:
        category = "highway"
        subcategory = tags.get("highway")
        buffer_default_m = 100
    elif tags.get("railway") in {"rail", "subway", "light_rail"}:
        category = "railway"
        subcategory = tags.get("railway")
        buffer_default_m = 100
    elif tags.get("waterway") in {"river", "canal"}:
        category = "waterway"
        subcategory = tags.get("waterway")
        buffer_default_m = 100
    elif tags.get("power") == "line":
        category = "power"
        subcategory = "line"
        buffer_default_m = 100
    elif tags.get("power") == "generator" and tags.get("generator:source") == "wind":
        category = "windturbine"
        subcategory = "wind_generator"
        buffer_default_m = 50

    if category is None:
        return None

    return {
        "source": "osm",
        "category": category,
        "subcategory": subcategory,
        "buffer_default_m": buffer_default_m,
        "metrics": {},
        "raw": tags,
    }


def fetch_osm_features(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    api = overpy.Overpass()

    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    query = f"""
    (
      way["aeroway"="aerodrome"]({bbox});
      relation["aeroway"="aerodrome"]({bbox});

      way["landuse"="military"]({bbox});
      relation["landuse"="military"]({bbox});

      way["amenity"="prison"]({bbox});
      relation["amenity"="prison"]({bbox});

      way["boundary"="protected_area"]({bbox});
      relation["boundary"="protected_area"]({bbox});

      way["waterway"~"river|canal"]({bbox});
      way["highway"~"motorway|trunk|primary"]({bbox});
      way["railway"~"rail|subway|light_rail"]({bbox});
      
      way["power"="line"]({bbox});

      node["power"="generator"]["generator:source"="wind"]({bbox});
      way["power"="generator"]["generator:source"="wind"]({bbox});
      relation["power"="generator"]["generator:source"="wind"]({bbox});
    );
    (._;>;);
    out body;
    """

    result = api.query(query)
    features = []

    for node in result.nodes:
        props = normalize_osm_properties(node.tags)
        if props is None:
            continue
        geometry = geojson.Point((float(node.lon), float(node.lat)))
        features.append(geojson.Feature(geometry=geometry, properties=props))

    for way in result.ways:
        props = normalize_osm_properties(way.tags)
        if props is None:
            continue
        coords = [(float(n.lon), float(n.lat)) for n in way.nodes]
        if len(coords) < 2:
            continue
        if coords[0] == coords[-1] and len(coords) >= 4:
            geometry = geojson.Polygon([coords])
        else:
            geometry = geojson.LineString(coords)
        features.append(geojson.Feature(geometry=geometry, properties=props))

    for rel in result.relations:
        props = normalize_osm_properties(rel.tags)
        if props is None:
            continue

        multipolygon = []
        for member in rel.members:
            if getattr(member, "_type_value", None) != "way":
                continue
            try:
                resolved = member.resolve()
            except Exception:
                continue
            coords = [(float(n.lon), float(n.lat)) for n in resolved.nodes]
            if coords and coords[0] == coords[-1] and len(coords) >= 4:
                multipolygon.append([coords])

        if multipolygon:
            geometry = geojson.MultiPolygon(multipolygon)
            features.append(geojson.Feature(geometry=geometry, properties=props))

    return features


def to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_zensus_features(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    grid_level: str,
    min_density: float,
):
    layer_id = ZENSUS_GRID_LAYER_MAP.get(grid_level, 0)
    layer_url = f"{ZENSUS_FEATURE_SERVICE}/{layer_id}/query"
    area_km2 = ZENSUS_GRID_AREA_KM2[grid_level]

    features = []
    offset = 0

    while True:
        data = fetch_json(
            layer_url,
            {
                "where": "1=1",
                "outFields": "OBJECTID,id,Einwohner",
                "returnGeometry": "true",
                "geometryType": "esriGeometryEnvelope",
                "spatialRel": "esriSpatialRelIntersects",
                "geometry": json.dumps(
                    {
                        "xmin": min_lon,
                        "ymin": min_lat,
                        "xmax": max_lon,
                        "ymax": max_lat,
                        "spatialReference": {"wkid": 4326},
                    }
                ),
                "inSR": "4326",
                "outSR": "4326",
                "resultOffset": str(offset),
                "resultRecordCount": "2000",
                "f": "geojson",
            },
        )

        batch = data.get("features", [])
        for feature in batch:
            raw = feature.get("properties") or {}
            einwohner = to_float(raw.get("Einwohner"))
            density = None if einwohner is None else round(einwohner / area_km2, 2)

            if density is not None and density < min_density:
                continue

            feature["properties"] = {
                "source": "zensus",
                "category": "zensus_density",
                "subcategory": grid_level,
                "buffer_default_m": 0,
                "metrics": {
                    "einwohner": einwohner,
                    "density_km2": density,
                },
                "raw": raw,
            }
            features.append(feature)

        exceeded = bool((data.get("properties") or {}).get("exceededTransferLimit"))
        if not exceeded or not batch:
            break

        offset += len(batch)
        if offset > 20000:
            break

    return features


@app.get("/generate-geojson")
def generate_geojson(
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    include_osm: bool = True,
    include_zensus: bool = False,
    zensus_grid: str = "100m",
    zensus_min_density: float = 0.0,
):
    width_km = haversine_km((min_lat + max_lat) / 2, min_lon, (min_lat + max_lat) / 2, max_lon)
    if width_km > 200:
        raise HTTPException(status_code=400, detail="Map width too large (> 200 km)")

    if zensus_grid not in ZENSUS_GRID_LAYER_MAP:
        raise HTTPException(status_code=400, detail="Unsupported zensus grid level.")

    features = []
    provider_errors = []

    if include_osm:
        try:
            features.extend(fetch_osm_features(min_lat, min_lon, max_lat, max_lon))
        except Exception as exc:
            provider_errors.append(f"OSM request failed: {exc}")

    if include_zensus:
        try:
            features.extend(
                fetch_zensus_features(
                    min_lat=min_lat,
                    min_lon=min_lon,
                    max_lat=max_lat,
                    max_lon=max_lon,
                    grid_level=zensus_grid,
                    min_density=max(0.0, zensus_min_density),
                )
            )
        except Exception as exc:
            provider_errors.append(f"Zensus request failed: {exc}")

    if not features and provider_errors:
        raise HTTPException(status_code=502, detail=" | ".join(provider_errors))

    return geojson.FeatureCollection(features)
