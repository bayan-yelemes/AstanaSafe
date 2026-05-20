import api from "../api/client";

export async function getDistrictsGeojson() {
  const { data } = await api.get("/roads/districts");

  return data;
}

export async function getStreets() {
  const { data } = await api.get("/roads/streets");
  const rawStreets = (data?.streets || []).filter(
    (item) => item && String(item).trim() !== "",
  );

  const uniqueMap = new Map();

  rawStreets.forEach((street) => {
    const cleanStreet = String(street).trim();
    const key = cleanStreet.toLowerCase();

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, cleanStreet);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

export async function getIntersections(street) {
  const { data } = await api.get("/roads/intersections", {
    params: { street },
  });

  const rawIntersections = Array.isArray(data?.intersections)
    ? data.intersections
    : [];

  const uniqueMap = new Map();

  rawIntersections.forEach((item) => {
    const crossroad = String(item?.crossroad || "").trim();
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);

    if (!crossroad || Number.isNaN(lat) || Number.isNaN(lng)) return;

    const key = crossroad.toLowerCase();

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        crossroad,
        lat,
        lng,
      });
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) =>
    a.crossroad.localeCompare(b.crossroad, "ru"),
  );
}

export async function getNearestLocation(lat, lng) {
  const { data } = await api.get("/roads/nearest-location", {
    params: { lat, lng },
  });

  return data;
}
