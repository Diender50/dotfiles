import AstalTray from "gi://AstalTray"
import { For, With, createBinding, onCleanup } from "ags"
import Gtk from "gi://Gtk?version=4.0"


export function Tray() {
  const tray = AstalTray.get_default()
  const items = createBinding(tray, "items")

  const init = (btn: Gtk.MenuButton, item: AstalTray.TrayItem) => {
    btn.menuModel = item.menuModel
    btn.insert_action_group("dbusmenu", item.actionGroup)
    item.connect("notify::action-group", () => {
      btn.insert_action_group("dbusmenu", item.actionGroup)
    })
  }

  return (
    <box class="tray">
      <For each={items}>
        {(item) => (
          <menubutton $={(self) => init(self, item)}>
            <image gicon={createBinding(item, "gicon")} pixelSize={16} />
          </menubutton>
        )}
      </For>
    </box>
  )
}