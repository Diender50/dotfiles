import { createBinding, createComputed } from "ags";
import AstalBattery from "gi://AstalBattery";
import AstalWp from "gi://AstalWp";

export const icons = {
   battery: {
      charging: "k-battery-charging-symbolic",
      3: "k-battery-dead-symbolic",
      2: "k-battery-half-symbolic",
      1: "k-battery-full-symbolic",
   },
   volume: {
      muted: "k-volume-mute-symbolic",
      1: "k-volume-off-symbolic",
      2: "k-volume-low-symbolic",
      3: "k-volume-medium-symbolic",
      4: "k-volume-high-symbolic",
   },
   microphone: {
    muted: "k-mic-off-symbolic",
    on: "k-mic-on-symbolic",
   }
};

export function getBatteryIcon(battery: AstalBattery.Device) {
   const percent = battery.percentage;
   if (battery.state === AstalBattery.State.CHARGING) {
      return icons.battery.charging;
   } else {
      if (percent <= 0.33) {
         return icons.battery[3];
      } else if (percent <= 0.66) {
         return icons.battery[2];
      } else {
         return icons.battery[1];
      }
   }
}

const battery = AstalBattery.get_default();
const batteryVar = createComputed([
   createBinding(battery, "percentage"),
   createBinding(battery, "state"),
]);
export const BatteryIcon = batteryVar(() => getBatteryIcon(battery));

export function getVolumeIcon(speaker?: AstalWp.Endpoint) {
   let volume = speaker?.volume;
   let muted = speaker?.mute;
   let speakerIcon = speaker?.icon;
   if (volume == null || speakerIcon == null) return "";

   if (volume === 0 || muted) {
      return icons.volume.muted;
   } else if (volume < 0.25) {
      return icons.volume[1];
   } else if (volume < 0.5) {
      return icons.volume[2];
   } else if (volume < 0.75) {
      return icons.volume[3];
   } else {
      return icons.volume[4];
   }
}
export function getMicroIcon(microphone?: AstalWp.Endpoint) {
   let volume = microphone?.volume;
   let muted = microphone?.mute;
   let microphoneIcon = microphone?.icon;
   if (volume == null || microphoneIcon == null) return "";

   if (volume === 0 || muted) {
      return icons.microphone.muted;
   } else {
      return icons.microphone.on;
   }
}
const wp = AstalWp.get_default();
const speaker = wp?.audio.defaultSpeaker!;
const speakerVar = createComputed([
   createBinding(speaker, "description"),
   createBinding(speaker, "volume"),
   createBinding(speaker, "mute"),
]);
const microphone = wp?.audio.defaultMicrophone!;
const microphoneVar = createComputed([
   createBinding(microphone, "description"),
   createBinding(microphone, "volume"),
   createBinding(microphone, "mute"),
]);
export const VolumeIcon = speakerVar(() => getVolumeIcon(speaker));
export const MicroIcon = microphoneVar(() => getMicroIcon(microphone));