import geopandas as gpd
import json

FILE = "../data/kazakhstan.gpkg"

DISTRICT_MAP = {
    "Алматы ауданы": "Almaty",
    "Алматы": "Almaty",

    "Байқоңыр ауданы": "Baikonur",
    "Байқоңыр": "Baikonur",

    "Есіл ауданы": "Esil",
    "Есіл": "Esil",
    "Yesil": "Esil",
    "Esil": "Esil",

    "Сарыарқа ауданы": "Saryarka",
    "Сарыарқа": "Saryarka",
    "Saryarka": "Saryarka",

    "Нұра ауданы": "Nura",
    "Нұра": "Nura",
    "Nura": "Nura",

    "Сарайшық ауданы": "Saraishyk",
    "Сарайшық": "Saraishyk",
    "Saraishyk": "Saraishyk",
}

TARGET_DISTRICTS = [
    "Almaty",
    "Baikonur",
    "Esil",
    "Nura",
    "Saryarka",
    "Saraishyk",
]

print("Loading admin areas...")
gdf = gpd.read_file(FILE, layer="gis_osm_adminareas_a_free")

print("Source CRS:", gdf.crs)

print("Keeping named polygons only...")
gdf = gdf[gdf["name"].notna()].copy()

print("Reprojecting to EPSG:4326...")
gdf = gdf.to_crs(epsg=4326)

print("Filtering Astana bbox...")
gdf = gdf.cx[71.20:71.60, 51.00:51.30].copy()

print("Mapping district names...")
gdf["district_en"] = gdf["name"].map(DISTRICT_MAP)

print("Keeping only target districts...")
gdf = gdf[gdf["district_en"].isin(TARGET_DISTRICTS)].copy()

print("Dissolving polygons by district...")
print(gdf[["name", "district_en"]].to_string())
districts = gdf[["district_en", "geometry"]].dissolve(by="district_en", as_index=False)

# Самые важные поля для frontend
districts["name"] = districts["district_en"]
districts["district"] = districts["district_en"]
districts["label"] = districts["district_en"]

# Оставляем только нужные поля
districts = districts[["district_en", "name", "district", "label", "geometry"]]

print("Export CRS:", districts.crs)

geojson = json.loads(districts.to_json())

with open("astana_districts.geojson", "w", encoding="utf-8") as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)

print("Saved astana_districts.geojson")
print("Districts found:", sorted(districts["district_en"].tolist()))