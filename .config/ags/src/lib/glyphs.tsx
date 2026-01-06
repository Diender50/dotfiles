import { createBinding, createComputed, createState } from "ags";
import AstalBattery from "gi://AstalBattery";
import AstalWp from "gi://AstalWp";
import AstalNetwork from "gi://AstalNetwork";

export const glyphs = {
  battery: {
    charging: "󰂄",
    0: "󰂃",
    10: "󰁺",
    20: "󰁻",
    30: "󰁼",
    40: "󰁽",
    50: "󰁾",
    60: "󰁿",
    70: "󰂀",
    80: "󰂁",
    90: "󰂂",
    100: "󰁹"
  },
  volume: {
    muted: "󰖁",
    low: "󰕿",
    medium: "󰖀",
    high: "󰕾",
  },
  microphone: {
    muted: "",
    on: "",
  },
  devices: {
    headphones: "",
    speaker: "󰓃",
    microphone: "",
    webcam: "󰖠",
    display: "󰍹",
    generic: "󰓃",
  },
  wifi: {
    off: "睊",
    on: "直", 
    connected: "󰄬",
  },
  bluetooth: {
    enabled: "󰂯",
    disabled: "󰂲",
    devices: {
      headphones: "",
      mouse: "󰍽",
      keyboard: "󰌌",
      phone: "󰏲",
      speaker: "󰓃",
      generic: "󰂱",
    },
  },
  nightlight: {
    enabled: "󰖔",
    disabled: "󰖨",
  },
  weather: {
    temperature: "",
    humidity: "",
    wind: "󰖝",
  },
  power: {
    menu: "󰐥",
    logout: "󰍃",
    reboot: "󰜉",
    shutdown: "󰐥",
  },
  mpris: {
    previous: "󰒮",
    play: "󰐊",
    pause: "󰏤",
    next: "󰒭",
    seekBackward: "󰒫", 
    seekForward: "󰒬", 
  },
};


// === Fonction pour obtenir glyphe batterie selon état ===
export function getBatteryGlyph(battery: AstalBattery.Device): string {
  const percent = battery.percentage;
  if (battery.state === AstalBattery.State.CHARGING) {
    return glyphs.battery.charging;
  }
  if (percent < 0.10) return glyphs.battery[0];
  if (percent < 0.20) return glyphs.battery[10];
  if (percent < 0.30) return glyphs.battery[20];
  if (percent < 0.40) return glyphs.battery[30];
  if (percent < 0.50) return glyphs.battery[40];
  if (percent < 0.60) return glyphs.battery[50];
  if (percent < 0.70) return glyphs.battery[60];
  if (percent < 0.80) return glyphs.battery[70];
  if (percent < 0.90) return glyphs.battery[80];
  if (percent < 1) return glyphs.battery[90];
  return glyphs.battery[100];
}


const battery = AstalBattery.get_default();
const batteryVar = createComputed([
  createBinding(battery, "percentage"),
  createBinding(battery, "state"),
]);
export const BatteryGlyph = batteryVar(() => getBatteryGlyph(battery));


// === Glyph dynamique pour volume ===
const wp = AstalWp.get_default();
const speaker = wp.audio.defaultSpeaker!;
const speakerVar = createComputed([
  createBinding(speaker, "volume"),
  createBinding(speaker, "mute"),
]);


export function getVolumeGlyph(speaker?: AstalWp.Endpoint): string {
  if (!speaker) return "";
  if (speaker.mute || speaker.volume === 0) return glyphs.volume.muted;
  if (speaker.volume < 0.33) return glyphs.volume.low;
  if (speaker.volume < 0.66) return glyphs.volume.medium;
  return glyphs.volume.high;
}


export const VolumeGlyph = speakerVar(() => getVolumeGlyph(speaker));


// === Glyph dynamique pour micro ===
const microphone = wp.audio.defaultMicrophone!;
const microphoneVar = createComputed([
  createBinding(microphone, "volume"),
  createBinding(microphone, "mute"),
]);


export function getMicroGlyph(microphone?: AstalWp.Endpoint): string {
  if (!microphone) return "";
  return microphone.mute ? glyphs.microphone.muted : glyphs.microphone.on;
}


export const MicroGlyph = microphoneVar(() => getMicroGlyph(microphone));


// === Fonction utilitaire pour choisir glyphe périphérique ===
export function getDeviceGlyph(device: { description: string }): string {
  const name = device.description.toLowerCase();
  if (name.includes("headphone") || name.includes("headset")) return glyphs.devices.headphones;
  if (name.includes("speaker")) return glyphs.devices.speaker;
  if (name.includes("microphone") || name.includes("mic")) return glyphs.devices.microphone;
  if (name.includes("webcam") || name.includes("camera")) return glyphs.devices.webcam;
  if (name.includes("hdmi") || name.includes("displayport")) return glyphs.devices.display;
  return glyphs.devices.generic;
}


// === Constantes WiFi pour les listes ===
export const WIFI_GLYPH_ON = glyphs.wifi.on;
export const WIFI_GLYPH_CONNECTED = glyphs.wifi.connected;


// === Glyph dynamique pour WiFi ===
const network = AstalNetwork.get_default();
const wifi = network.wifi;

function getWifiGlyphValue(): string {
  if (!wifi) return glyphs.wifi.off;
  return wifi.activeAccessPoint ? glyphs.wifi.on : glyphs.wifi.off;
}

const [wifiGlyphState] = createState(getWifiGlyphValue());

export const WifiGlyph = wifi
  ? createComputed([createBinding(wifi, "activeAccessPoint")])(() => getWifiGlyphValue())
  : wifiGlyphState;


// === Fonction pour obtenir glyphe bluetooth selon état ===
export function getBluetoothGlyph(enabled: boolean): string {
  return enabled ? glyphs.bluetooth.enabled : glyphs.bluetooth.disabled;
}


// === Fonction pour obtenir glyphe d'appareil bluetooth selon son nom ===
export function getBluetoothDeviceGlyph(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes("headphone") || nameLower.includes("headset") ||
      nameLower.includes("buds") || nameLower.includes("airpods")) {
    return glyphs.bluetooth.devices.headphones;
  } else if (nameLower.includes("mouse")) {
    return glyphs.bluetooth.devices.mouse;
  } else if (nameLower.includes("keyboard")) {
    return glyphs.bluetooth.devices.keyboard;
  } else if (nameLower.includes("phone") || nameLower.includes("galaxy") ||
             nameLower.includes("iphone") || nameLower.includes("pixel")) {
    return glyphs.bluetooth.devices.phone;
  } else if (nameLower.includes("speaker")) {
    return glyphs.bluetooth.devices.speaker;
  } else {
    return glyphs.bluetooth.devices.generic;
  }
}


// === Fonction pour obtenir glyphe night light selon état ===
export function getNightLightGlyph(enabled: boolean): string {
  return enabled ? glyphs.nightlight.enabled : glyphs.nightlight.disabled;
}

