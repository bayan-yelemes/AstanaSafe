import geopandas as gpd
import json

FILE_PATH = "../data/kazakhstan.gpkg"

print("Loading GeoPackage...")

gdf = gpd.read_file(FILE_PATH, layer="gis_osm_roads_free")

print("Columns:", gdf.columns.tolist())

gdf = gdf[gdf["name"].notna()].copy()

# Astana bbox
gdf = gdf.cx[71.20:71.60, 51.00:51.30]

street_map = {}

for _, row in gdf.iterrows():
    name = str(row["name"]).strip()
    geom = row.geometry

    if not name or geom is None:
        continue

    coords = []

    try:
        if geom.geom_type == "LineString":
            for x, y in geom.coords:
                coords.append({
                    "lat": round(y, 6),
                    "lng": round(x, 6)
                })

        elif geom.geom_type == "MultiLineString":
            for line in geom.geoms:
                for x, y in line.coords:
                    coords.append({
                        "lat": round(y, 6),
                        "lng": round(x, 6)
                    })
    except:
        continue

    if not coords:
        continue

    street_map.setdefault(name, []).extend(coords)

result = []

for name, points in street_map.items():
    seen = set()
    clean_points = []

    for p in points:
        key = (p["lat"], p["lng"])
        if key in seen:
            continue
        seen.add(key)
        clean_points.append(p)

    result.append({
        "name": name,
        "points": clean_points
    })

result.sort(key=lambda x: x["name"].lower())

with open("astana_streets.json", "w", encoding="utf-8") as f:
    json.dump({"streets": result}, f, ensure_ascii=False, indent=2)

print("Saved astana_streets.json")
print("Total streets:", len(result))