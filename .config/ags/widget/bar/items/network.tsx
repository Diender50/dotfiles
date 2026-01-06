import AstalNetwork from "gi://AstalNetwork"
import { Gtk } from "ags/gtk4"
import { For, With, createBinding, createState, createComputed, onMount } from "ags"
import { execAsync } from "ags/process"
import { WifiGlyph, WIFI_GLYPH_ON, WIFI_GLYPH_CONNECTED } from "../../../src/lib/glyphs"

export function Wireless() {
  const network: AstalNetwork.Network = AstalNetwork.get_default()
  const wifi = createBinding(network, "wifi")

  const [revealedMap, setRevealedMap] = createState(new Map<string, boolean>())
  const [passwordMap, setPasswordMap] = createState(new Map<string, string>())
  const [wifiEnabled, setWifiEnabled] = createState<boolean>(true)
  const [knownNetworks, setKnownNetworks] = createState(new Set<string>())

  const sortedUnique = (arr: AstalNetwork.AccessPoint[]): AstalNetwork.AccessPoint[] => {
    const seen = new Set<string>()
    const filtered = arr.filter((ap: AstalNetwork.AccessPoint) => {
      if (!ap.ssid) return false
      if (seen.has(ap.ssid)) return false
      seen.add(ap.ssid)
      return true
    })
    return filtered.sort((a: AstalNetwork.AccessPoint, b: AstalNetwork.AccessPoint) => b.strength - a.strength)
  }

  async function refreshWifiState(): Promise<void> {
    try {
      const res: string = await execAsync("nmcli radio wifi")
      setWifiEnabled(res.trim() === "enabled")
    } catch (e) {
      console.error(e)
    }
  }

  async function refreshKnownConnections(): Promise<void> {
    try {
      const res: string = await execAsync(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
      console.log("=== RÉSULTAT BRUT nmcli ===")
      console.log("Longueur:", res.length)
      console.log("Premières 500 chars:", res.substring(0, 500))
      
      const connections = new Set<string>()
      const lines: string[] = res.trim().split('\n')
      console.log("Nombre de lignes:", lines.length)
      
      let wifiCount: number = 0
      let vpnCount: number = 0
      
      for (const line of lines) {
        if (!line) continue
        
        // Format: NAME:TYPE
        const colonIndex: number = line.lastIndexOf(':')
        if (colonIndex === -1) {
          console.log("Pas de colon dans:", line)
          continue
        }
        
        const name: string = line.substring(0, colonIndex).trim()
        const type: string = line.substring(colonIndex + 1).trim()
        
        if (type === 'vpn') vpnCount++
        
        // Ne garder QUE les connexions wifi
        if (type === 'wifi' || type === '802-11-wireless') {
          wifiCount++
          console.log(`WIFI TROUVÉ: name="${name}", type="${type}"`)
          connections.add(name)
        }
      }
      
      console.log(`Résumé: ${wifiCount} wifi, ${vpnCount} vpn sur ${lines.length} lignes`)
      console.log("Connexions WiFi connues:", Array.from(connections))
      setKnownNetworks(connections)
    } catch (e) {
      console.error("Erreur récupération connexions connues:", e)
    }
  }

  async function refreshWifiList(): Promise<void> {
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

  function toggleRevealer(ssid: string): void {
    setRevealedMap((prev: Map<string, boolean>) => {
      const map = new Map(prev)
      map.set(ssid, !map.get(ssid))
      return map
    })
  }

  async function connectWithPassword(ap: AstalNetwork.AccessPoint): Promise<void> {
    const password: string = passwordMap.get().get(ap.ssid) || ""
    try {
      await execAsync(["nmcli", "device", "wifi", "connect", ap.ssid, "password", password])
      setRevealedMap((prev: Map<string, boolean>) => {
        const map = new Map(prev)
        map.delete(ap.ssid)
        return map
      })
      await refreshWifiList()
    } catch (error) {
      console.error(error)
    }
  }

  async function connectKnown(ssid: string): Promise<void> {
    try {
      await execAsync(["nmcli", "connection", "up", ssid])
      await refreshWifiList()
    } catch (error) {
      console.error(error)
    }
  }

  async function forgetKnown(ssid: string): Promise<void> {
    try {
      await execAsync(["nmcli", "connection", "delete", ssid])
      setRevealedMap((prev: Map<string, boolean>) => {
        const map = new Map(prev)
        map.delete(ssid)
        return map
      })
      await refreshKnownConnections()
    } catch (error) {
      console.error(error)
    }
  }

  async function toggleWifi(): Promise<void> {
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

  function onPasswordChange(ssid: string, newValue: string): void {
    setPasswordMap((prev: Map<string, string>) => {
      const map = new Map(prev)
      map.set(ssid, newValue)
      return map
    })
  }

  function renderAccessPoint(ap: AstalNetwork.AccessPoint, wifiObj: AstalNetwork.Wifi) {
    const isActive = createBinding(wifiObj, "activeAccessPoint")((active: AstalNetwork.AccessPoint | null) => 
      !!(active && active.ssid === ap.ssid)
    )
    const isKnown = knownNetworks((networks: Set<string>) => networks.has(ap.ssid))
    const isNotKnown = knownNetworks((networks: Set<string>) => !networks.has(ap.ssid))

    return (
      <box orientation={Gtk.Orientation.VERTICAL} marginTop={6}>
        <button onClicked={() => toggleRevealer(ap.ssid)}>
          <box spacing={4}>
            <label label={WIFI_GLYPH_ON} />
            <label label={createBinding(ap, "ssid")} />
            <label label={WIFI_GLYPH_CONNECTED} visible={isActive} />
          </box>
        </button>

        <revealer
          hexpand={false}
          revealChild={revealedMap((stateMap: Map<string, boolean>) => !!stateMap.get(ap.ssid))}
          transitionDuration={200}
          transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
        >
          <box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={4}>
            <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8} marginTop={4} visible={isNotKnown}>
              <entry
                placeholderText="Mot de passe"
                hexpand={true}
                onNotifyText={({ text }: { text: string }) => onPasswordChange(ap.ssid, text)}
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

  const percentBinding = createBinding(network.wifi, "activeAccessPoint")((ap: AstalNetwork.AccessPoint | null) => 
    ap ? `${ap.strength}%` : ""
  )

  const glyphAndPercentBinding = createComputed([WifiGlyph, percentBinding])(
    (values: [string, string]) => {
      const [glyph, percent] = values;
      return percent ? `${glyph} ${percent}` : glyph;
    }
  )

  return (
      <With value={wifi}>
        {(wifiObj: AstalNetwork.Wifi | null) =>
          wifiObj && (
            <menubutton class="network">
              <label label={glyphAndPercentBinding} />
              <popover>
                <scrolledwindow
                  hscrollbarPolicy={Gtk.PolicyType.NEVER}
                  vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                  heightRequest={300}
                  widthRequest={250}
                  propagateNaturalHeight={false}
                >
                  <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                    <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                      <label label="WiFi:" valign={Gtk.Align.CENTER} />
                      <switch 
                        active={wifiEnabled} 
                        onNotifyActive={toggleWifi}
                        valign={Gtk.Align.CENTER}
                      />
                      <button onClicked={refreshWifiList} halign={Gtk.Align.END} hexpand>
                        <label label="Rafraîchir" />
                      </button>
                    </box>

                    <For each={createBinding(wifiObj, "accessPoints")(sortedUnique)}>
                      {(ap: AstalNetwork.AccessPoint) => renderAccessPoint(ap, wifiObj)}
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
