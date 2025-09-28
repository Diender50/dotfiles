import AstalBluetooth from "gi://AstalBluetooth"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { For, With, createBinding, createState, onMount } from "ags"
import { execAsync } from "ags/process"

export function Bluetooth() {
    const bluetooth = AstalBluetooth.get_default()

    const [revealedMap, setRevealedMap] = createState(new Map())
    const [bluetoothEnabled, setBluetoothEnabled] = createState(false)
    const [isScanning, setIsScanning] = createState(false)
    const [allDevices, setAllDevices] = createState([])
    const [isChangingState, setIsChangingState] = createState(false)

    // Vérifier l'état bluetooth
    async function checkPowerState() {
        try {
            const result = await execAsync(["bluetoothctl", "show"])
            const powered = result.includes("Powered: yes")
            setBluetoothEnabled(powered)
            console.log("État bluetooth:", powered)
            return powered
        } catch (e) {
            console.error("Erreur vérification état bluetooth:", e)
            return false
        }
    }

    // Vérifier si un device est connecté
    async function checkDeviceConnection(mac) {
        try {
            const result = await execAsync(["bluetoothctl", "info", mac])
            return result.includes("Connected: yes")
        } catch (e) {
            return false
        }
    }

    // Vérifier si un device est appairé
    async function checkDevicePaired(mac) {
        try {
            const result = await execAsync(["bluetoothctl", "info", mac])
            return result.includes("Paired: yes")
        } catch (e) {
            return false
        }
    }

    // Récupérer tous les devices
    async function getDevices() {
        try {
            const result = await execAsync(["bluetoothctl", "devices"])
            const devices = []

            for (const line of result.split('\n')) {
                const match = line.match(/Device ([A-F0-9:]+) (.+)/)
                if (match) {
                    const mac = match[1]
                    const name = match[2].trim()

                    const connected = await checkDeviceConnection(mac)
                    const paired = await checkDevicePaired(mac)

                    console.log(`Device ${name}: paired=${paired}, connected=${connected}`)

                    devices.push({
                        address: mac,
                        name: name,
                        connected: connected,
                        paired: paired,
                        icon: getDeviceIconByName(name)
                    })
                }
            }

            console.log("Devices trouvés:", devices.length)
            return devices
        } catch (e) {
            console.error("Erreur récupération devices:", e)
            return []
        }
    }

    // Scanner les devices
    async function scanDevices() {
        if (isScanning.get()) {
            console.log("Scan déjà en cours")
            return
        }

        console.log("Début scan 10s")
        setIsScanning(true)

        try {
            await execAsync(["bluetoothctl", "--timeout", "10", "scan", "on"])
            await refreshDeviceList()
            setIsScanning(false)
            console.log("Scan terminé")
        } catch (e) {
            console.log("Scan terminé:", e.message)
            setIsScanning(false)
            await refreshDeviceList()
        }
    }

    async function refreshDeviceList() {
        console.log("Rafraîchissement liste devices")
        const devices = await getDevices()
        setAllDevices(devices)
    }

    // Toggle power
    async function handleTogglePower() {
        console.log("SWITCH TOGGLED - fonction appelée")

        if (isChangingState.get()) {
            console.log("Changement d'état en cours, ignoré")
            return
        }

        setIsChangingState(true)

        try {
            const currentState = bluetoothEnabled.get()
            console.log("Toggle bluetooth, état actuel:", currentState)

            if (currentState) {
                console.log("Tentative désactivation...")
                await execAsync(["bluetoothctl", "power", "off"])
                console.log("Bluetooth désactivé")
            } else {
                console.log("Tentative activation...")

                try {
                    await execAsync(["rfkill", "unblock", "bluetooth"])
                    await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (e) {
                    console.log("rfkill non disponible ou déjà débloqué")
                }

                await execAsync(["bluetoothctl", "power", "on"])
                console.log("Bluetooth activé")

                setTimeout(async () => {
                    await refreshDeviceList()
                }, 2000)
            }

            setTimeout(async () => {
                await checkPowerState()
                setIsChangingState(false)
            }, 1000)

        } catch (e) {
            console.error("ERREUR toggle power:", e)
            setTimeout(async () => {
                await checkPowerState()
                setIsChangingState(false)
            }, 500)
        }
    }

    function getDeviceIconByName(name) {
        const nameLower = name.toLowerCase()
        if (nameLower.includes("headphone") || nameLower.includes("headset") ||
            nameLower.includes("buds") || nameLower.includes("airpods")) {
            return "audio-headphones-symbolic"
        } else if (nameLower.includes("mouse")) {
            return "input-mouse-symbolic"
        } else if (nameLower.includes("keyboard")) {
            return "input-keyboard-symbolic"
        } else if (nameLower.includes("phone") || nameLower.includes("galaxy") ||
            nameLower.includes("iphone") || nameLower.includes("pixel")) {
            return "phone-symbolic"
        } else if (nameLower.includes("speaker")) {
            return "audio-speakers-symbolic"
        } else {
            return "bluetooth-symbolic"
        }
    }

    onMount(async () => {
        console.log("Initialisation Bluetooth")
        await checkPowerState()
        if (bluetoothEnabled.get()) {
            await refreshDeviceList()
        }
    })

    function toggleRevealer(deviceId) {
        setRevealedMap(prev => {
            const map = new Map(prev)
            map.set(deviceId, !map.get(deviceId))
            return map
        })
    }

    async function connectDevice(device) {
        try {
            console.log("Connexion à", device.name)
            await execAsync(["bluetoothctl", "connect", device.address])

            setTimeout(async () => {
                await refreshDeviceList()
                setRevealedMap(prev => {
                    const map = new Map(prev)
                    map.delete(device.address)
                    return map
                })
            }, 2000)
        } catch (error) {
            console.error("Erreur connexion:", error)
        }
    }

    async function disconnectDevice(device) {
        try {
            console.log("Déconnexion de", device.name)
            await execAsync(["bluetoothctl", "disconnect", device.address])

            setTimeout(async () => {
                await refreshDeviceList()
            }, 1000)
        } catch (error) {
            console.error("Erreur déconnexion:", error)
        }
    }

    // Appairage + Connexion automatique
    async function pairDevice(device) {
        try {
            console.log("Appairage avec", device.name)

            // Étape 1: Appairage
            await execAsync(["bluetoothctl", "pair", device.address])
            console.log("Appairage réussi pour", device.name)

            // Étape 2: Trust
            try {
                await execAsync(["bluetoothctl", "trust", device.address])
                console.log("Device trusted:", device.name)
            } catch (e) {
                console.log("Impossible de trust le device:", e.message)
            }

            // Attendre un peu pour que l'appairage soit bien établi
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Étape 3: Connexion automatique
            try {
                console.log("Connexion automatique à", device.name)
                await execAsync(["bluetoothctl", "connect", device.address])
                console.log("Connexion automatique réussie pour", device.name)
            } catch (e) {
                console.log("Erreur connexion automatique:", e.message)
                // Même si la connexion échoue, on continue
            }

            // Fermer le revealer et rafraîchir
            setRevealedMap(prev => {
                const map = new Map(prev)
                map.delete(device.address)
                return map
            })

            // Rafraîchir après un délai pour voir l'état final
            setTimeout(async () => {
                await refreshDeviceList()
                console.log("Appairage + connexion terminés pour", device.name)
            }, 2000)

        } catch (error) {
            console.error("Erreur appairage:", error)
        }
    }

    async function unpairDevice(device) {
        try {
            console.log("Suppression appairage", device.name)
            await execAsync(["bluetoothctl", "remove", device.address])

            setRevealedMap(prev => {
                const map = new Map(prev)
                map.delete(device.address)
                return map
            })

            setTimeout(async () => {
                await refreshDeviceList()
            }, 1000)
        } catch (error) {
            console.error("Erreur suppression appairage:", error)
        }
    }

    const sortedDevices = (devices) => {
        if (!Array.isArray(devices)) return []

        return devices.sort((a, b) => {
            if (a.connected && !b.connected) return -1
            if (!a.connected && b.connected) return 1
            if (a.paired && !b.paired) return -1
            if (!a.paired && b.paired) return 1
            return a.name.localeCompare(b.name)
        })
    }

    function renderDevice(device) {
        const deviceId = device.address
        const isPaired = device.paired
        const isConnected = device.connected

        return (
            <box orientation={Gtk.Orientation.VERTICAL} marginTop={6}>
                <button onClicked={() => toggleRevealer(deviceId)}>
                    <box spacing={4}>
                        <image iconName={device.icon} />
                        <label label={device.name} />
                        {isConnected && <image iconName="object-select-symbolic" />}
                    </box>
                </button>

                <revealer
                    hexpand={false}
                    revealChild={revealedMap(stateMap => !!stateMap.get(deviceId))}
                    transitionDuration={200}
                    transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                >
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={8} marginTop={4}>
                        {/* Bouton pour appareils non appairés */}
                        <box
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={8}
                            visible={!isPaired}
                            homogeneous={true}
                            hexpand={true}
                        >
                            <button hexpand={true} onClicked={() => pairDevice(device)}>
                                <label label="Appairer & Connecter" />
                            </button>
                        </box>

                        {/* Boutons pour appareils appairés */}
                        <box
                            orientation={Gtk.Orientation.HORIZONTAL}
                            spacing={8}
                            visible={isPaired}
                            homogeneous={true}
                            hexpand={true}
                        >
                            <button
                                hexpand={true}
                                onClicked={() => isConnected ? disconnectDevice(device) : connectDevice(device)}
                            >
                                <label label={isConnected ? "Déconnecter" : "Connecter"} />
                            </button>
                            <button hexpand={true} onClicked={() => unpairDevice(device)}>
                                <label label="Oublier" />
                            </button>
                        </box>
                    </box>
                </revealer>
            </box>
        )
    }

    return (
        <menubutton class="bluetooth">
            <image
                iconName={bluetoothEnabled(enabled => enabled ? "bluetooth-active-symbolic" : "bluetooth-disabled-symbolic")}
                pixelSize={16}
            />
            <popover>
                <scrolledwindow
                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                    heightRequest={300}
                    widthRequest={280}
                    propagateNaturalHeight={false}
                >
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={10} hexpand>
                            <label label="Bluetooth:" valign={Gtk.Align.CENTER} />

                            <switch
                                active={bluetoothEnabled}
                                onNotifyActive={handleTogglePower} 
                            />

                            <box hexpand={true} />
                            <button
                                label={isScanning(scanning => scanning ? "Scan..." : "Scanner")}
                                onClicked={scanDevices}
                                sensitive={bluetoothEnabled(enabled => enabled && !isScanning.get())}
                            />
                        </box>

                        <For each={allDevices(sortedDevices)}>
                            {device => renderDevice(device)}
                        </For>

                        <box visible={bluetoothEnabled} hexpand>
                            <label
                                label={allDevices(devices => `${devices.length} appareils trouvés`)}
                                css="font-size: 0.8em; opacity: 0.6;"
                            />
                        </box>

                        <box visible={bluetoothEnabled(enabled => enabled && allDevices.get().length === 0 && !isScanning.get())} hexpand>
                            <label
                                label="Activez le Bluetooth sur vos appareils et lancez un scan."
                                css="font-size: 0.9em; opacity: 0.7;"
                                wrap
                            />
                        </box>
                    </box>
                </scrolledwindow>
            </popover>
        </menubutton>

    )
}
