import geopandas as gpd
import json

FILE = "../data/kazakhstan.gpkg"

print("Loading roads layer...")
gdf = gpd.read_file(FILE, layer="gis_osm_roads_free")

print("Filtering Astana area...")
gdf = gdf.cx[71.20:71.60, 51.00:51.30]

gdf = gdf[gdf["name"].notna()].copy()
gdf = gdf[["name", "geometry"]]

print("Building intersections...")
intersections_by_street = {}

rows = list(gdf.itertuples(index=False))
total = len(rows)

for i, row1 in enumerate(rows):
    name1 = row1.name
    geom1 = row1.geometry

    if i % 200 == 0:
        print(f"Processing {i}/{total}")

    for j in range(i + 1, total):
        row2 = rows[j]
        name2 = row2.name
        geom2 = row2.geometry

        if name1 == name2:
            continue

        if not geom1.bounds or not geom2.bounds:
            continue

        if not geom1.intersects(geom2):
            continue

        inter = geom1.intersection(geom2)

        if inter.is_empty:
            continue

        points = []
        if inter.geom_type == "Point":
            points = [inter]
        elif inter.geom_type == "MultiPoint":
            points = list(inter.geoms)

        for pt in points:
            item1 = {
                "crossroad": name2,
                "lat": round(pt.y, 6),
                "lng": round(pt.x, 6),
            }
            item2 = {
                "crossroad": name1,
                "lat": round(pt.y, 6),
                "lng": round(pt.x, 6),
            }

            intersections_by_street.setdefault(name1, []).append(item1)
            intersections_by_street.setdefault(name2, []).append(item2)

print("Removing duplicates...")
cleaned = {}

for street, items in intersections_by_street.items():
    seen = set()
    unique_items = []

    for item in items:
        key = (item["crossroad"], item["lat"], item["lng"])
        if key not in seen:
            seen.add(key)
            unique_items.append(item)

    unique_items.sort(key=lambda x: x["crossroad"])
    cleaned[street] = unique_items

with open("astana_intersections.json", "w", encoding="utf-8") as f:
    json.dump(cleaned, f, ensure_ascii=False, indent=2)

print("Saved astana_intersections.json")
print("Total streets with intersections:", len(cleaned))