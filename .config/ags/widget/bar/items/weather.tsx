import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"

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

function loadWlSunsetConfig(): WlSunsetConfig | null {
  try {
    const configPath = `${GLib.get_home_dir()}/.config/ags/wlsunset.json`
    const [success, contents] = GLib.file_get_contents(configPath)
    
    if (!success) return null
    
    const decoder = new TextDecoder()
    const jsonString = decoder.decode(contents)
    return JSON.parse(jsonString) as WlSunsetConfig
  } catch (error) {
    console.error("Error loading wlsunset config:", error)
    return null
  }
}

function fetchWeatherData(): WeatherData | null {
  const config = loadWlSunsetConfig()
  if (!config) return null

  const API_KEY = "1766e4b7d9cb10d20b0296504f6a85a2"
  const API_URL = "https://api.openweathermap.org/data/2.5/weather"
  const url = `${API_URL}?lat=${config.latitude}&lon=${config.longitude}&appid=${API_KEY}&units=metric&lang=fr`

  try {
    const process = GLib.spawn_command_line_sync(`curl -sf "${url}"`)
    
    if (process[0] && process[1]) {
      const decoder = new TextDecoder()
      const response = decoder.decode(process[1])
      const data = JSON.parse(response)
      
      if (data.cod === 200) {
        return {
          temperature: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          city: data.name,
          humidity: data.main.humidity,
          feelsLike: Math.round(data.main.feels_like),
          windSpeed: Math.round(data.wind.speed * 3.6)
        }
      }
    }
  } catch (error) {
    console.error("Error fetching weather:", error)
  }
  
  return null
}

function WeatherPopoverContent({ data }: { data: WeatherData }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      {/* Header */}
      <box spacing={8} halign={Gtk.Align.CENTER}>
        <label 
          label={getWeatherIcon(data.icon)} 
          class="weather-icon-large"
        />
        <box orientation={Gtk.Orientation.VERTICAL}>
          <label 
            label={`${data.temperature}°C`} 
            class="temperature-main"
          />
          <label 
            label={data.city} 
            class="city-name"
          />
        </box>
      </box>

      {/* Description */}
      <label 
        label={data.description.charAt(0).toUpperCase() + data.description.slice(1)} 
        class="weather-description"
        halign={Gtk.Align.CENTER}
      />

      {/* Détails */}
      <Gtk.Separator />
      
      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <box spacing={8}>
          <image iconName="temperature-symbolic" pixelSize={14} />
          <label label="Ressenti:" />
          <label label={`${data.feelsLike}°C`} hexpand halign={Gtk.Align.END} />
        </box>
        
        <box spacing={8}>
          <image iconName="weather-few-clouds-symbolic" pixelSize={14} />
          <label label="Humidité:" />
          <label label={`${data.humidity}%`} hexpand halign={Gtk.Align.END} />
        </box>
        
        <box spacing={8}>
          <image iconName="weather-windy-symbolic" pixelSize={14} />
          <label label="Vent:" />
          <label label={`${data.windSpeed} km/h`} hexpand halign={Gtk.Align.END} />
        </box>
      </box>

      {/* Bouton refresh */}
      <Gtk.Separator />
      <button 
        class="refresh-button"
        onClicked={() => {
          const newData = fetchWeatherData()
          console.log("Manual refresh:", newData)
        }}
      >
        <box spacing={4} halign={Gtk.Align.CENTER}>
          <image iconName="view-refresh-symbolic" pixelSize={12} />
          <label label="Actualiser" />
        </box>
      </button>
    </box>
  )
}

function WeatherErrorContent() {
  return (
    <box 
      orientation={Gtk.Orientation.VERTICAL}
      spacing={8}
      class="weather-error"
    >
      <image iconName="weather-severe-alert-symbolic" pixelSize={32} />
      <label label="Impossible de charger la météo" />
      <button 
        onClicked={() => {
          const testData = fetchWeatherData()
          console.log("Test fetch:", testData)
        }}
      >
        <label label="Réessayer" />
      </button>
    </box>
  )
}

export function Weather() {
  // Poll simple qui retourne string pour le bouton
  const buttonText = createPoll("...", 600000, () => {
    console.log("Fetching weather for button...")
    const data = fetchWeatherData()
    if (data) {
      return `${getWeatherIcon(data.icon)} ${data.temperature}°`
    }
    return "⚠"
  })

  // Fonction pour obtenir le contenu du popover
  const getPopoverContent = () => {
    const data = fetchWeatherData()
    console.log("Getting popover content, data:", data)
    
    if (data) {
      return <WeatherPopoverContent data={data} />
    }
    
    return <WeatherErrorContent />
  }

  return (
    <menubutton class="weather">
      <label label={buttonText} />
      <popover>
        <box 
          orientation={Gtk.Orientation.VERTICAL}
          spacing={12}
          class="weather-popover"
        >
          {getPopoverContent()}
        </box>
      </popover>
    </menubutton>
  )
}
