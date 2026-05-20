import geopandas as gpd
import json

FILE = "../data/kazakhstan.gpkg"

print("Loading roads layer...")
gdf = gpd.read_file(FILE, layer="gis_osm_roads_free")

print("Filtering Astana area...")

# Astana approximate bounding box
gdf = gdf.cx[71.20:71.60, 51.00:51.30]

# keep only rows with names
gdf = gdf[gdf["name"].notna()]

streets = sorted(gdf["name"].unique().tolist())

with open("astana_streets.json", "w", encoding="utf-8") as f:
    json.dump({"streets": streets}, f, ensure_ascii=False, indent=2)

print("Saved astana_streets.json")
