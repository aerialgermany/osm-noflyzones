# OSM No-Fly Zone Visualizer

This project allows you to visualize and filter **drone no-fly zones** based on OpenStreetMap data, and export selected areas as GeoJSON files. It includes an interactive Leaflet map, a category-based filter interface, and a FastAPI backend for live GeoJSON generation based on the visible map area.

---

## ✨ Features

- Interactive map with **no-fly zones** (airports, military areas, prisons, nature reserves)
- Real-time filtering by category
- **Dynamic GeoJSON generation** based on map bounds
- Download filtered zones as GeoJSON
- Compatible with tools like [FlightPlanEditor.de](https://www.flightplaneditor.de) from [Aerial Germany](https://aerial-germany.de)

---

## 🚀 Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/aerialgermany/osm-noflyzones.git
cd osm-noflyzones
```

### 2. Create a virtual environment (Python 3.9+ recommended)

```bash
python -m venv venv
source venv/bin/activate        # on Linux/macOS
venv\Scripts\activate.bat       # on Windows
```

### 3. Install the dependencies

```bash
pip install -r requirements.txt
```

> Requirements include:
> - `fastapi`
> - `uvicorn`
> - `overpy`
> - `geojson`
> - `python-multipart`

### 4. Start the FastAPI server

```bash
uvicorn main:app --reload
```

### 5. Open in your browser

Visit [http://localhost:8000](http://localhost:8000)  
You should see the interactive map interface with filter options.

---

## 📤 Export & Integration

You can export the currently visible no-fly zones as a **filtered GeoJSON file** and upload it into [FlightPlanEditor.de](https://www.flightplaneditor.de) from [Aerial Germany](https://aerial-germany.de) to use it in drone flight planning scenarios.

---

## 📄 License

This project is licensed under the **Apache License 2.0** – see [LICENSE](LICENSE) for details.

---

## 💡 Credits

Built with ❤️ using:
- [OpenStreetMap](https://www.openstreetmap.org)
- [Leaflet.js](https://leafletjs.com/)
- [FastAPI](https://fastapi.tiangolo.com)


---

## ⚠️ Disclaimer

The data visualized and exported through this tool is based on OpenStreetMap and publicly available sources.  
**It does not constitute legally binding or official no-fly zone information.**  
No liability is assumed for the accuracy, completeness, or legal applicability of the displayed data.

📌 **Always consult your local aviation authority or competent government agencies** for current and legally binding airspace and no-fly zone regulations before conducting drone operations.

