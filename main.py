from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import overpy
import geojson
from starlette.responses import RedirectResponse
from fastapi import HTTPException

app = FastAPI()

# CORS für Browser-Fetch
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return RedirectResponse(url="/web/index.html")

# Static files (web frontend)
app.mount("/web", StaticFiles(directory="web", html=True), name="web")

def haversine_km(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, asin
    R = 6371
    dlon = radians(lon2 - lon1)
    lat1 = radians(lat1)
    lat2 = radians(lat2)
    a = cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    return 2 * R * asin(sqrt(a))

@app.get("/generate-geojson")
def generate_geojson(min_lat: float, min_lon: float, max_lat: float, max_lon: float):
    width_km = haversine_km((min_lat + max_lat) / 2, min_lon,
                            (min_lat + max_lat) / 2, max_lon)
    if width_km > 200:
        raise HTTPException(status_code=400, detail="Map size too wide (> 200 km)")

    api = overpy.Overpass()
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"

    query = f"""
    (
      way["aeroway"="aerodrome"]({bbox});
      way["landuse"="military"]({bbox});
      way["amenity"="prison"]({bbox});
      way["boundary"="protected_area"]({bbox});
    );
    (._;>;);
    out body;
    """
    result = api.query(query)

    features = []

    for way in result.ways:
        coords = [(float(node.lon), float(node.lat)) for node in way.nodes]
        if coords[0] != coords[-1]:
            coords.append(coords[0])  # make closed polygon

        properties = way.tags
        geometry = geojson.Polygon([coords])
        feature = geojson.Feature(geometry=geometry, properties=properties)
        features.append(feature)

    return geojson.FeatureCollection(features)
