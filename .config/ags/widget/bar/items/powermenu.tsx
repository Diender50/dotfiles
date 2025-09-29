import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"

interface PowerActionProps {
  iconName: string
  tooltip: string
  command: string
  className?: string
}

function PowerAction({ iconName, tooltip, command, className = "" }: PowerActionProps) {
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
      <image iconName={iconName} pixelSize={24} />
    </button>
  )
}

export function PowerMenu() {
  return (
    <menubutton class="powermenu">
      <image iconName="system-shutdown-symbolic" pixelSize={16} />
      
      <popover>
        <box 
          orientation={Gtk.Orientation.HORIZONTAL}
          spacing={16}
          class="power-popover"
        >
          <PowerAction
            iconName="system-log-out-symbolic"
            tooltip="Logout"
            command="niri msg action quit"
            className="logout"
          />
          
          <PowerAction
            iconName="system-reboot-symbolic"
            tooltip="Reboot"
            command="loginctl reboot"
            className="logout"
          />
          
          <PowerAction
            iconName="system-shutdown-symbolic"
            tooltip="Shutdown"
            command="loginctl poweroff"
            className="logout"
          />
        </box>
      </popover>
    </menubutton>
  )
}
