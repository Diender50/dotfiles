import AstalBattery from "gi://AstalBattery"
import AstalPowerProfiles from "gi://AstalPowerProfiles"
import Gtk from "gi://Gtk?version=4.0"

import { createBinding } from "ags"

import {
   icons,
   BatteryIcon,
} from "../../../src/lib/icons";

export function Battery() {
  const battery = AstalBattery.get_default()
  const powerprofiles = AstalPowerProfiles.get_default()

  const percent = createBinding(
    battery,
    "percentage",
  )((p) => `${Math.floor(p * 100)}%`)

  const setProfile = (profile: string) => {
    powerprofiles.set_active_profile(profile)
  }

  return (
    <box class="battery">
        <image
               visible={createBinding(battery, "isPresent")}
               pixelSize={16}
               iconName={BatteryIcon}
            />
    </box>
  )
}