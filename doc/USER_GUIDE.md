# No-Fly Zone Web App – Quick User Guide

This interactive web application helps you visualize and export potential drone no-fly zones using OpenStreetMap data and Zensus density grid data.

---

## 🚀 Getting Started

1. Open the application in your browser: `http://localhost:8000`
2. Use the **category checkboxes** on the right to show or hide types of restricted areas:
   - Airports
   - Military zones
   - Prisons
   - Protected areas
   - Wind Turbines
   - Roads (Highways)
   - Railways
   - Waterways
   - Powerlines
   - Zensus Density Grid

3. Use the **Search Location** field to jump to any place by typing a city or address and pressing **Enter**.

4. Adjust the **buffer width** (in meters) for:
   - Roads
   - Railways
   - Waterways
   - Powerlines

   The default buffer width is **100 meters**, but you can customize it.

5. For Zensus data, use the dedicated controls:
   - **Density class**:
     - Very low (`< 100`)
     - Low (`100 - 400`)
     - Medium (`400 - 1000`)
     - High (`>= 1000`)
     - Custom
   - **Grid**: choose between `100m`, `1km`, and `10km`.
   - **Custom min density** is only active when **Custom** class is selected.
   - Click **Update View** after changing grid or filters to fetch data for the current map extent.

## 🌬️ Wind Turbines

- When you select **"Windturbines"** in the sidebar, all wind turbines from OpenStreetMap will be displayed.
- Each wind turbine is shown as a marker and automatically surrounded by a **50 m no-fly zone buffer circle**.
- These circles are visible on the map and included in both **GeoJSON** and **KML** exports.
- The buffer around wind turbines is fixed at 50 meters and does not depend on the adjustable buffer width setting.


---

## 💾 Export Data

- Use the **GeoJSON** or **KML** buttons to download the currently visible and selected zones.
- Export includes buffered polygons for selected linear features (roads, railways, waterways, powerlines, and wind turbines).
- Zensus export is optimized as polygon areas:
  - only polygonal Zensus features are exported
  - adjacent Zensus grid cells are merged where possible to reduce file size

---

## 🖼 Interface Preview

![Screenshot](screenshot.png)

---

## ⏳ Loading Overlay

- When loading new data, a **loading screen** appears.
- It disappears automatically when the update is complete.

---

## ℹ️ Notes

- Buffering is only applied to linear features (roads, railways, waterways, powerlines).
- Map updates are limited to areas smaller than **200 km** in width.
- Zensus is enabled by default in the sidebar.
- Always verify drone restrictions with **official local aviation authorities**.
- This tool provides **unofficial information** and no liability is assumed.