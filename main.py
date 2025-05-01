from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.responses import RedirectResponse
import overpy
import geojson
from math import radians, sin, cos, sqrt, asin

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

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)
    a = cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    return 2 * R * asin(sqrt(a))

@app.get("/generate-geojson")
def generate_geojson(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
    width_km = haversine_km((min_lat + max_lat) / 2, min_lon, (min_lat + max_lat) / 2, max_lon)
    if width_km > 200:
        raise HTTPException(status_code=400, detail="Map width too large (> 200 km)")

    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    api = overpy.Overpass()

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

    # Nodes (Points)
    for node in result.nodes:
        geometry = geojson.Point((float(node.lon), float(node.lat)))
        feature = geojson.Feature(geometry=geometry, properties=node.tags)
        features.append(feature)

    # Ways (Lines or Polygons)
    for way in result.ways:
        coords = [(float(n.lon), float(n.lat)) for n in way.nodes]
        geometry = geojson.Polygon([coords]) if coords[0] == coords[-1] else geojson.LineString(coords)
        feature = geojson.Feature(geometry=geometry, properties=way.tags)
        features.append(feature)

    # Relations (MultiPolygon)
    for rel in result.relations:
        multipolygon = []
        for m in rel.members:
            if isinstance(m, overpy.Way):
                coords = [(float(n.lon), float(n.lat)) for n in m.resolve().nodes]
                if coords: multipolygon.append([coords])
        if multipolygon:
            geometry = geojson.MultiPolygon(multipolygon)
            feature = geojson.Feature(geometry=geometry, properties=rel.tags)
            features.append(feature)

    return geojson.FeatureCollection(features)
