import app from "ags/gtk4/app"
import Astal from "gi://Astal?version=4.0"
import Gdk from "gi://Gdk?version=4.0"


import { onCleanup } from "ags"

import { Clock } from "./items/clock"
import { Battery } from "./items/battery"
import { Audio } from "./items/volume"
import { Wireless } from "./items/network"
import { Bluetooth } from "./items/bluetooth"
import { Tray } from "./items/tray"
import { WlSunset } from "./items/wlsunset"
import { Mpris } from "./items/mpris"
import { NiriWorkspaces } from "./items/niri"
import { PowerMenu } from "./items/powermenu"
import { Weather } from "./items/weather"
import { Updates } from "./items/updates"



export default function Bar({ gdkmonitor }: { gdkmonitor: Gdk.Monitor }) {
  let win: Astal.Window
  const { BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

  onCleanup(() => {
    win.destroy()
  })

  return (
    <window
      $={(self) => (win = self)}
      class="Bar"
      visible
      namespace="Bar"
      name={`bar-${gdkmonitor.connector}`}
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={BOTTOM | LEFT | RIGHT}
      application={app}
      keymode={Astal.Keymode.ON_DEMAND}
    >
      <centerbox cssName="centerbox">
        <box $type="start" spacing={8}>
          <NiriWorkspaces gdkmonitor={gdkmonitor} />
          <Updates />
          <Mpris />
        </box>
        <box $type="center" spacing={8}>
          <Clock />
          <Weather />
        </box>
        <box $type="end" spacing={8}>
          <Tray />
          <WlSunset />
          <Bluetooth />
          <Wireless />
          <Audio />
          <Battery />
          <PowerMenu />
        </box>
      </centerbox>
    </window>
  )
}