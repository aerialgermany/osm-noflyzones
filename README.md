# OSM No-Fly Zone Visualizer

This project allows you to visualize and filter **drone no-fly zones** based on OpenStreetMap data and Zensus density grid data, and export selected areas as GeoJSON or KML files.  
It includes an interactive Leaflet map, category-based filtering, adjustable buffer width, Zensus density classes, live data loading via FastAPI, and export functionality.

---

## ✨ Features

- Interactive map with **no-fly zones**:
  - Airports
  - Military areas
  - Prisons
  - Protected nature reserves
  - Roads (motorways, primary roads)
  - Railways
  - Waterways (rivers, canals)
  - Powerlines
  - **Zensus density grid (NEW!)**
  - **Wind turbines (NEW!)**
- **Adjustable buffer width** (default 100 meters) for linear features (roads, railways, waterways, powerlines)
- **Zensus controls**:
  - Density class presets (`Very low`, `Low`, `Medium`, `High`) or `Custom`
  - Grid resolution selector (`100m`, `1km`, `10km`)
- **Search location** by typing a city/address and pressing **Enter**
- **Loading overlay** while fetching and processing new data
- **Dynamic GeoJSON or KML download** for currently visible map features
- Works perfectly with tools like [FlightPlanEditor.de](https://www.flightplaneditor.de)

---

## 🚀 Setup Instructions

1. Clone or download this repository.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate   # Linux/macOS
   .\venv\Scripts\activate # Windows
   ```
3. Install the requirements:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
5. Open the app in your browser:
   ```
   http://localhost:8000
   ```

---

## 📤 Export & Integration

- Download **GeoJSON** or **KML** files based on your current map selection.
- Buffer zones are automatically created for roads, railways, waterways, powerlines, and wind turbines (50 m fixed).
- Zensus exports are polygon-only and adjacent Zensus cells are merged where possible to reduce file size.
- You can upload the exported files into [FlightPlanEditor.de](https://www.flightplaneditor.de) to plan and manage your drone missions.

---

## 🖼 Interface Preview

![Screenshot](doc/screenshot.png)

---

## 📄 License

Licensed under the [Apache License 2.0](LICENSE).

---

## ⚠️ Disclaimer

This tool provides **unofficial, non-binding information**.  
Always consult your **local aviation authority** for official and legally binding no-fly zone data.  
**No liability** is assumed for the correctness or completeness of the displayed data.
