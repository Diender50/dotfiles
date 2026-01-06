import { createState } from "ags"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { execAsync } from "ags/process"
import { glyphs } from "../../../src/lib/glyphs"

interface WeatherData {
  temperature: number
  description: string
  icon: string
  city: string
  humidity: number
  feelsLike: number
  windSpeed: number
}

interface WlSunsetConfig {
  tempLow: number
  tempHigh: number
  duration: number
  latitude: number
  longitude: number
}

function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "", 
    "01n": "", 
    "02d": "", 
    "02n": "", 
    "03d": "󰅣", 
    "03n": "󰅣",
    "04d": "", 
    "04n": "",
    "09d": "", 
    "09n": "",
    "10d": "", 
    "10n": "", 
    "11d": "", 
    "11n": "",
    "13d": "", 
    "13n": "",
    "50d": "󰖑", 
    "50n": "󰖑",
  }
  
  return iconMap[iconCode] || ""
}


async function loadWlSunsetConfig(): Promise<WlSunsetConfig | null> {
  console.log("[Weather] Loading wlsunset config...")
  try {
    const configPath = `${GLib.get_home_dir()}/.config/ags/wlsunset.json`
    const [success, contents] = GLib.file_get_contents(configPath)
    if (!success) {
      console.log("[Weather] Config file not found")
      return null
    }
    const decoder = new TextDecoder()
    const config = JSON.parse(decoder.decode(contents)) as WlSunsetConfig
    console.log(`[Weather] Config loaded: lat=${config.latitude}, lon=${config.longitude}`)
    return config
  } catch (e) {
    console.error("[Weather] Error loading config:", e)
    return null
  }
}


async function fetchWeatherData(): Promise<WeatherData | null> {
  console.log("[Weather] Starting weather fetch...")
  const config = await loadWlSunsetConfig()
  if (!config) {
    console.log("[Weather] No config, aborting fetch")
    return null
  }
  
  const API_KEY = "1766e4b7d9cb10d20b0296504f6a85a2"
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${config.latitude}&lon=${config.longitude}&appid=${API_KEY}&units=metric&lang=fr`
  
  console.log("[Weather] Calling API...")
  try {
    const response = await execAsync(["curl", "-sf", url])
    if (!response) {
      console.log("[Weather] Empty response from API")
      return null
    }
    console.log("[Weather] API response received, parsing...")
    const data = JSON.parse(response)
    console.log("[Weather] Parsed data:", JSON.stringify(data, null, 2))
    
    if (data.cod === 200) {
      const weatherData = {
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        city: data.name,
        humidity: data.main.humidity,
        feelsLike: Math.round(data.main.feels_like),
        windSpeed: Math.round(data.wind.speed * 3.6),
      }
      console.log("[Weather] Weather data ready:", weatherData)
      return weatherData
    } else {
      console.log(`[Weather] API returned error code: ${data.cod}`)
      return null
    }
  } catch (e) {
    console.error("[Weather] Fetch error:", e)
    return null
  }
}


// STATE GLOBAL partagé entre tous les écrans - INITIALISÉ avec des données vides
const [globalWeatherData, setGlobalWeatherData] = createState<WeatherData>({
  temperature: 0,
  description: "Chargement...",
  icon: "01d",
  city: "...",
  humidity: 0,
  feelsLike: 0,
  windSpeed: 0,
})


let fetchInProgress = false
let globalIntervalId: number | null = null


async function globalRefreshWeather() {
  if (fetchInProgress) {
    console.log("[Weather] Fetch already in progress, skipping")
    return
  }
  
  console.log("[Weather] === Starting global refresh ===")
  fetchInProgress = true
  const data = await fetchWeatherData()
  
  if (data) {
    console.log("[Weather] Setting global weather data:", data)
    setGlobalWeatherData(data)
  } else {
    console.log("[Weather] No data returned, keeping current state")
  }
  
  fetchInProgress = false
  console.log("[Weather] === Refresh complete ===")
}


// Démarre le fetch global une seule fois
if (globalIntervalId === null) {
  console.log("[Weather] Initializing weather widget - starting first fetch")
  globalRefreshWeather()
  globalIntervalId = setInterval(() => {
    console.log("[Weather] Interval triggered - refreshing weather")
    globalRefreshWeather()
  }, 600000) as unknown as number
  console.log("[Weather] Interval set for 10 minutes")
}


export function Weather() {
  return (
    <menubutton class="weather" >
      <label label={globalWeatherData((data) => `${getWeatherIcon(data.icon)}  ${data.temperature}°`)} />
      <popover >
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12} class="weather-popover">
          <box spacing={8} halign={Gtk.Align.CENTER}>
            <label label={globalWeatherData((data) => getWeatherIcon(data.icon))} class="weather-icon-large" />
            <box orientation={Gtk.Orientation.VERTICAL}>
              <label label={globalWeatherData((data) => `${data.temperature}°C`)} class="temperature-main" />
              <label label={globalWeatherData((data) => data.city)} class="city-name" />
            </box>
          </box>

          <label label={globalWeatherData((data) => data.description.charAt(0).toUpperCase() + data.description.slice(1))} class="weather-description" halign={Gtk.Align.CENTER} />


          <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <box spacing={8}>
              <label label={glyphs.weather.temperature} class="weather-detail-icon" />
              <label label="Ressenti:" />
              <label label={globalWeatherData((data) => `${data.feelsLike}°C`)} hexpand halign={Gtk.Align.END} />
            </box>

            <box spacing={8}>
              <label label={glyphs.weather.humidity} class="weather-detail-icon" />
              <label label="Humidité:" />
              <label label={globalWeatherData((data) => `${data.humidity}%`)} hexpand halign={Gtk.Align.END} />
            </box>

            <box spacing={8}>
              <label label={glyphs.weather.wind} class="weather-detail-icon" />
              <label label="Vent:" />
              <label label={globalWeatherData((data) => `${data.windSpeed} km/h`)} hexpand halign={Gtk.Align.END} />
            </box>
          </box>

          <button class="refresh-button" onClicked={() => {
            console.log("[Weather] Manual refresh button clicked")
            globalRefreshWeather()
          }}>
            <box spacing={4} halign={Gtk.Align.CENTER}>
              <label label="󰑓" class="refresh-icon" />
              <label label="Actualiser" />
            </box>
          </button>
        </box>
      </popover>
    </menubutton>
  )
}