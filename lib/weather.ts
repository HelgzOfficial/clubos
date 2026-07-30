// Live weather for the club's ground via Open-Meteo — a free, keyless API,
// so this works with no extra account or secret to configure.
// Coordinates are for Whyteleafe / Caterham, Surrey (Church Road, CR3),
// where AFC Whyteleafe play their home fixtures.
const CLUB_LAT = 51.298;
const CLUB_LON = -0.0812;

export type LiveWeather = {
  tempC: number;
  condition: string;
  windKph: number;
  chanceOfRain: number;
};

// WMO weather codes -> short human label (subset covering what UK weather
// realistically throws at a matchday).
const CONDITION_LABELS: Record<number, string> = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

export async function fetchLiveWeather(): Promise<LiveWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${CLUB_LAT}&longitude=${CLUB_LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=Europe%2FLondon&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't reach the weather service.");
  const data = await res.json();

  const currentHourIso: string = data.current?.time ?? "";
  const hourIndex = Array.isArray(data.hourly?.time) ? data.hourly.time.indexOf(currentHourIso) : -1;
  const chanceOfRain = hourIndex >= 0 ? data.hourly.precipitation_probability?.[hourIndex] ?? 0 : 0;

  return {
    tempC: Math.round(data.current?.temperature_2m ?? 0),
    condition: CONDITION_LABELS[data.current?.weather_code] ?? "Unknown",
    windKph: Math.round(data.current?.wind_speed_10m ?? 0),
    chanceOfRain: Math.round(chanceOfRain),
  };
}
