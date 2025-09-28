import AstalNetwork from "gi://AstalNetwork"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { For, With, createBinding, createState, onMount } from "ags"
import { execAsync } from "ags/process"

export function Wireless() {
  const network = AstalNetwork.get_default()
  const wifi = createBinding(network, "wifi")

  const [revealedMap, setRevealedMap] = createState(new Map())
  const [passwordMap, setPasswordMap] = createState(new Map())
  const [wifiEnabled, setWifiEnabled] = createState(true)
  const [knownNetworks, setKnownNetworks] = createState(new Set())

  const sortedUnique = (arr) => {
    const seen = new Set()
    const filtered = arr.filter(ap => {
      if (!ap.ssid) return false
      if (seen.has(ap.ssid)) return false
      seen.add(ap.ssid)
      return true
    })
    return filtered.sort((a, b) => b.strength - a.strength)
  }

  async function refreshWifiState() {
    try {
      const res = await execAsync("nmcli radio wifi")
      setWifiEnabled(res.trim() === "enabled")
    } catch (e) {
      console.error(e)
    }
  }

  async function refreshKnownConnections() {
    try {
      const res = await execAsync("nmcli -t -f NAME,TYPE connection show")
      const connections = new Set()
      res.split('\n').forEach(line => {
        const [name, type] = line.split(':')
        if (type === 'wifi' || type === '802-11-wireless') {
          connections.add(name.trim())
        }
      })
      setKnownNetworks(connections)
    } catch (e) {
      console.error("Erreur récupération connexions connues:", e)
    }
  }

  async function refreshWifiList() {
    try {
      await network.wifi.scan()
      await refreshKnownConnections()
    } catch (e) {
      console.error("Erreur scan wifi:", e)
    }
  }

  onMount(() => {
    refreshWifiState()
    refreshWifiList()
  })

  function toggleRevealer(ssid) {
    setRevealedMap(prev => {
      const map = new Map(prev)
      map.set(ssid, !map.get(ssid))
      return map
    })
  }

  async function connectWithPassword(ap) {
    const password = passwordMap.get().get(ap.ssid) || ""
    try {
      await execAsync(["nmcli", "device", "wifi", "connect", ap.ssid, "password", password])
      setRevealedMap(prev => {
        const map = new Map(prev)
        map.delete(ap.ssid)
        return map
      })
      await refreshWifiList()
    } catch (error) {
      console.error(error)
      // Ajouter gestion visuelle d'erreur ici si souhaité
    }
  }

  async function connectKnown(ssid) {
    try {
      await execAsync(["nmcli", "connection", "up", ssid])
      await refreshWifiList()
    } catch (error) {
      console.error(error)
    }
  }

  async function forgetKnown(ssid) {
    try {
      await execAsync(["nmcli", "connection", "delete", ssid])
      setRevealedMap(prev => {
        const map = new Map(prev)
        map.delete(ssid)
        return map
      })
      await refreshKnownConnections()
    } catch (error) {
      console.error(error)
    }
  }

  async function toggleWifi() {
    try {
      if (wifiEnabled.get()) {
        await execAsync(["nmcli", "radio", "wifi", "off"])
        setWifiEnabled(false)
      } else {
        await execAsync(["nmcli", "radio", "wifi", "on"])
        setWifiEnabled(true)
        await refreshWifiList()
      }
    } catch (e) {
      console.error("Erreur toggle wifi:", e)
    }
  }

  function onPasswordChange(ssid, newValue) {
    setPasswordMap(prev => {
      const map = new Map(prev)
      map.set(ssid, newValue)
      return map
    })
  }

  function renderAccessPoint(ap, wifiObj) {
    const isActive = createBinding(wifiObj, "activeAccessPoint")(active => active && active.ssid === ap.ssid)
    const isKnown = knownNetworks(networks => networks.has(ap.ssid))
    const isNotKnown = knownNetworks(networks => !networks.has(ap.ssid))

    return (
      <box orientation={Gtk.Orientation.VERTICAL} marginTop={6}>
        <button onClicked={() => toggleRevealer(ap.ssid)}>
          <box spacing={4}>
            <image iconName={createBinding(ap, "iconName")} />
            <label label={createBinding(ap, "ssid")} />
            <image iconName="object-select-symbolic" visible={isActive} />
          </box>
        </button>

        <revealer
          hexpand={false}
          revealChild={revealedMap(stateMap => !!stateMap.get(ap.ssid))}
          transitionDuration={200}
          transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
        >
          <box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={4}>
            <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} marginTop={4} visible={isNotKnown}>
              <entry
                placeholderText="Mot de passe"
                hexpand={true}
                onNotifyText={({ text }) => onPasswordChange(ap.ssid, text)}
              />
              <button onClicked={() => connectWithPassword(ap)}>
                <label label="Ok" />
              </button>
            </box>
            <box
              orientation={Gtk.Orientation.HORIZONTAL}
              spacing={8}
              marginTop={4}
              visible={isKnown}
              homogeneous={true}
              hexpand={true}
            >
              <button hexpand={true} onClicked={() => connectKnown(ap.ssid)}>
                <label label="Connecter" />
              </button>
              <button hexpand={true} onClicked={() => forgetKnown(ap.ssid)}>
                <label label="Oublier" />
              </button>
            </box>
          </box>
        </revealer>
      </box>
    )
  }

  return (
      <With value={wifi}>
        {wifiObj =>
          wifiObj && (
            <menubutton class="network">
              <image iconName={createBinding(wifiObj, "iconName")} pixelSize={16} />
              <popover>
                <scrolledwindow
                  hscrollbarPolicy={Gtk.PolicyType.NEVER}
                  vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                  heightRequest={300}
                  widthRequest={250}
                  propagateNaturalHeight={false}
                >
                  <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                    <box orientation={Gtk.Orientation.HORIZONTAL} spacing={10} hexpand>
                      <label label="WiFi:" valign={Gtk.Align.CENTER} />
                      <switch active={wifiEnabled} onNotifyActive={toggleWifi} />
                      <button label="Rafraîchir" onClicked={refreshWifiList} halign={Gtk.Align.END} hexpand  />
                    </box>

                    <For each={createBinding(wifiObj, "accessPoints")(sortedUnique)}>
                      {ap => renderAccessPoint(ap, wifiObj)}
                    </For>
                  </box>
                </scrolledwindow>
              </popover>
            </menubutton>
          )
        }
      </With>
  )
}
