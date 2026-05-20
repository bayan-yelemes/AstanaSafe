import requests
import json

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

query = """
[out:json][timeout:120];
(
  way["highway"]["name"](51.00,71.20,51.30,71.60);
);
out tags;
"""

print("Downloading Astana roads...")

response = requests.get(
    OVERPASS_URL,
    params={"data": query},
    timeout=180,
    headers={"User-Agent": "AstanaSafe/1.0"}
)

print("Status code:", response.status_code)
print("First 300 chars of response:")
print(response.text[:300])

if response.status_code != 200:
    raise Exception(f"Overpass returned status {response.status_code}")

try:
    data = response.json()
except Exception:
    raise Exception("Response was not JSON. See printed response above.")

seen = set()
streets = []

for el in data.get("elements", []):
    tags = el.get("tags", {})
    name = tags.get("name")
    if name and name not in seen:
        seen.add(name)
        streets.append(name)

streets.sort()

with open("astana_streets.json", "w", encoding="utf-8") as f:
    json.dump({"streets": streets}, f, ensure_ascii=False, indent=2)

print("Saved astana_streets.json")
print("Total streets:", len(streets))
