import { ASTANA_COORDS } from "../constants/city";
import { normalizeWeatherCode } from "../utils/normalizers";

export async function getCurrentWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${ASTANA_COORDS.lat}&longitude=${ASTANA_COORDS.lng}` +
    "&current=temperature_2m,weather_code&timezone=Asia/Almaty";

  const response = await fetch(url);
  const data = await response.json();
  const temp = data?.current?.temperature_2m ?? null;
  const code = data?.current?.weather_code ?? null;

  return {
    temperature: temp !== null ? Math.round(temp) : null,
    condition: normalizeWeatherCode(code),
    city: "Astana",
  };
}
