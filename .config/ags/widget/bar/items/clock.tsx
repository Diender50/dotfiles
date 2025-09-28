import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"

export function Clock({ format = "%A %d %B - %Hh%M" }) {
  const time = createPoll("", 1000, () => {
    return GLib.DateTime.new_now_local().format(format)!
  })

  return (
    <menubutton class="clock">
      <label label={time} />
      <popover>
        <Gtk.Calendar />
      </popover>
    </menubutton>
  )
}