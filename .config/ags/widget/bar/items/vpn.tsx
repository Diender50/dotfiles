import { Astal, Gdk, Gtk } from "ags/gtk4"
import { createState, onMount } from "ags"
import { execAsync, exec } from "ags/process"
import GLib from "gi://GLib"

export function VPN() {
  const [isConnected, setIsConnected] = createState(false)
  const [isLoading, setIsLoading] = createState(false)

  function checkStatus() {
    try {
      const res = exec(["nordvpn", "status"])
      setIsConnected(res.toString().includes("Connected"))
    } catch (e) {
      setIsConnected(false)
    }
  }
function uint8ArrayToString(arr: Uint8Array) {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(arr);
}

function toggle() {
  setIsLoading(true)
  try {
    const cmd = isConnected.get() ? "nordvpn disconnect" : "nordvpn connect"
    const [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(cmd)

    if (!ok || status !== 0) {
      console.error("[VPN] Command failed:", uint8ArrayToString(stderr))
    } else {
      console.log("[VPN] Command output:", uint8ArrayToString(stdout))
    }
    setTimeout(checkStatus, 2000)
  } catch (e) {
    console.error("[VPN] Exception:", e)
  } finally {
    setIsLoading(false)
  }
}





  onMount(() => checkStatus())

  return (
    <button class="vpn" onClicked={toggle} sensitive={isLoading(l => !l)}>
      <box spacing={4}>
        <image 
          iconName={isConnected(c => c ? "network-vpn-symbolic" : "network-vpn-offline-symbolic")} 
          pixelSize={16}
        />
        <label label={isConnected(c => c ? "VPN" : "Off")} />
      </box>
    </button>
  )
}
