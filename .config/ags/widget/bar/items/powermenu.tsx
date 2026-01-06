import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { glyphs } from "../../../src/lib/glyphs"


interface PowerActionProps {
  glyph: string
  tooltip: string
  command: string
  className?: string
}


function PowerAction({ glyph, tooltip, command, className = "" }: PowerActionProps) {
  const handleClick = () => {
    try {
      GLib.spawn_command_line_async(command)
    } catch (error) {
      console.error(`Failed to execute command: ${command}`, error)
    }
  }


  return (
    <button
      class={`power-action ${className}`}
      onClicked={handleClick}
      tooltipText={tooltip}
    >
      <label label={glyph} class="power-glyph" />
    </button>
  )
}


export function PowerMenu() {
  return (
    <menubutton class="powermenu">
      <label label={glyphs.power.menu} />
      
      <popover>
        <box 
          orientation={Gtk.Orientation.HORIZONTAL}
          spacing={16}
          class="power-popover"
        >
          <PowerAction
            glyph={glyphs.power.logout}
            tooltip="Logout"
            command="niri msg action quit"
          />
          
          <PowerAction
            glyph={glyphs.power.reboot}
            tooltip="Reboot"
            command="loginctl reboot"
          />
          
          <PowerAction
            glyph={glyphs.power.shutdown}
            tooltip="Shutdown"
            command="loginctl poweroff"
          />
        </box>
      </popover>
    </menubutton>
  )
}
