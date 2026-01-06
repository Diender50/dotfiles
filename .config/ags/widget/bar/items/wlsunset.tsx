import Gtk from "gi://Gtk?version=4.0"
import GLib from "gi://GLib"
import { createState, onMount } from "ags"
import { execAsync } from "ags/process"
import { getNightLightGlyph } from "../../../src/lib/glyphs"


const CONFIG_FILE = `${GLib.get_home_dir()}/.config/ags/wlsunset.json`


// STATES GLOBAUX partagés entre tous les écrans
const [globalIsActive, setGlobalIsActive] = createState(false)
const [globalTempLow, setGlobalTempLow] = createState(4000)
const [globalTempHigh, setGlobalTempHigh] = createState(6500)
const [globalDuration, setGlobalDuration] = createState(900)
const [globalLatitude, setGlobalLatitude] = createState(51.6)
const [globalLongitude, setGlobalLongitude] = createState(7.4)
const [globalLocationLoading, setGlobalLocationLoading] = createState(false)


// Verrou pour éviter les appels multiples
let toggleInProgress = false


// Valeurs par défaut
const defaultConfig = {
    isActive: false,
    tempLow: 4000,
    tempHigh: 6500,
    duration: 900,
    latitude: 51.6,
    longitude: 7.4
}


// Charger les paramètres sauvegardés
function loadConfig(): void {
    try {
        const configData = GLib.file_get_contents(CONFIG_FILE)[1]
        const config = JSON.parse(new TextDecoder().decode(configData))

        setGlobalTempLow(config.tempLow || defaultConfig.tempLow)
        setGlobalTempHigh(config.tempHigh || defaultConfig.tempHigh)
        setGlobalDuration(config.duration || defaultConfig.duration)
        setGlobalLatitude(config.latitude || defaultConfig.latitude)
        setGlobalLongitude(config.longitude || defaultConfig.longitude)

        console.log("[WlSunset] Configuration chargée")
        
        // Restaurer l'état actif/inactif
        const wasActive = config.isActive || defaultConfig.isActive
        console.log(`[WlSunset] État sauvegardé: ${wasActive ? "activé" : "désactivé"}`)
        
        if (wasActive) {
            console.log("[WlSunset] Restauration de wlsunset...")
            startWlsunset()
            setGlobalIsActive(true)
        }
    } catch (e) {
        console.log("[WlSunset] Aucune configuration trouvée, utilisation des valeurs par défaut")
    }
}


// Sauvegarder les paramètres
function saveConfig(): void {
    try {
        const config = {
            isActive: globalIsActive.get(),
            tempLow: globalTempLow.get(),
            tempHigh: globalTempHigh.get(),
            duration: globalDuration.get(),
            latitude: globalLatitude.get(),
            longitude: globalLongitude.get()
        }

        const configDir = `${GLib.get_home_dir()}/.config/ags`
        GLib.mkdir_with_parents(configDir, 0o755)

        GLib.file_set_contents(CONFIG_FILE, JSON.stringify(config, null, 2))
        console.log("[WlSunset] Configuration sauvegardée")
    } catch (e) {
        console.error("[WlSunset] Erreur sauvegarde config:", e)
    }
}


// Réinitialiser aux valeurs par défaut
function resetToDefaults(): void {
    setGlobalTempLow(defaultConfig.tempLow)
    setGlobalTempHigh(defaultConfig.tempHigh)
    setGlobalDuration(defaultConfig.duration)
    setGlobalLatitude(defaultConfig.latitude)
    setGlobalLongitude(defaultConfig.longitude)
    saveConfig()
    console.log("[WlSunset] Paramètres réinitialisés aux valeurs par défaut")
}


// Vérifier le statut de wlsunset
async function checkStatus(): Promise<void> {
    try {
        await execAsync(["pgrep", "-x", "wlsunset"])
        if (!globalIsActive.get()) {
            setGlobalIsActive(true)
            saveConfig()
        }
    } catch {
        if (globalIsActive.get()) {
            setGlobalIsActive(false)
            saveConfig()
        }
    }
}


// Démarrer wlsunset en arrière-plan
function startWlsunset(): void {
    try {
        GLib.spawn_async(
            null,
            [
                "wlsunset",
                "-l", globalLatitude.get().toString(),
                "-L", globalLongitude.get().toString(),
                "-t", globalTempLow.get().toString(),
                "-T", globalTempHigh.get().toString(),
                "-d", globalDuration.get().toString()
            ],
            null,
            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
            null
        )
        console.log("[WlSunset] Wlsunset started")
    } catch (e) {
        console.error("[WlSunset] Error starting wlsunset:", e)
    }
}


// Toggle wlsunset
async function toggleWlsunset(): Promise<void> {
    if (toggleInProgress) {
        console.log("[WlSunset] Toggle already in progress, skipping")
        return
    }

    toggleInProgress = true
    console.log("[WlSunset] Toggle started, current state:", globalIsActive.get())

    try {
        if (globalIsActive.get()) {
            console.log("[WlSunset] Stopping wlsunset...")
            await execAsync(["pkill", "-x", "wlsunset"])
            setGlobalIsActive(false)
            saveConfig()
            console.log("[WlSunset] Wlsunset stopped")
        } else {
            console.log("[WlSunset] Starting wlsunset...")
            startWlsunset()
            setGlobalIsActive(true)
            saveConfig()
        }
    } catch (e) {
        console.error("[WlSunset] Erreur toggle wlsunset:", e)
    } finally {
        toggleInProgress = false
        console.log("[WlSunset] Toggle finished")
    }
}


// Géolocalisation automatique
async function detectLocation(): Promise<void> {
    setGlobalLocationLoading(true)

    try {
        const result = await execAsync([
            "curl", "-s", "-m", "10",
            "http://ip-api.com/json/?fields=lat,lon,city,country"
        ])

        const data = JSON.parse(result)
        if (data.lat && data.lon) {
            setGlobalLatitude(Math.round(data.lat * 100) / 100)
            setGlobalLongitude(Math.round(data.lon * 100) / 100)
            saveConfig()
            console.log(`[WlSunset] Position détectée: ${data.city}, ${data.country}`)
        }
    } catch (e) {
        console.error("[WlSunset] Erreur géolocalisation:", e)
    } finally {
        setGlobalLocationLoading(false)
    }
}


// Redémarrer wlsunset avec nouveaux paramètres
async function restartWlsunset(): Promise<void> {
    if (!globalIsActive.get()) return

    try {
        await execAsync(["pkill", "-x", "wlsunset"])
        startWlsunset()
        saveConfig()
    } catch (e) {
        console.error("[WlSunset] Erreur restart:", e)
    }
}


// Initialisation globale une seule fois
let initialized = false
if (!initialized) {
    console.log("[WlSunset] Initializing...")
    loadConfig()
    checkStatus()
    // Vérifier le statut toutes les 5 secondes
    setInterval(checkStatus, 5000)
    initialized = true
}


export function WlSunset() {
    return (
        <menubutton class="wlsunset">
            <label
                label={globalIsActive((active: boolean) => getNightLightGlyph(active))}
            />
            <popover>
                <box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={10}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={8}
                    marginEnd={8}
                >
                    {/* Header avec switch */}
                    <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                        <label
                            label="Night Light:"
                            valign={Gtk.Align.CENTER}
                        />
                        <switch
                            active={globalIsActive}
                            onNotifyActive={toggleWlsunset}
                            halign={Gtk.Align.END}
                            hexpand
                        />
                    </box>

                    {/* Température jour */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={3}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <label
                                label="Température jour:"
                                halign={Gtk.Align.START}
                                hexpand
                            />
                            <label
                                label={globalTempHigh((temp: number) => `${temp}K`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={5000}
                            max={7000}
                            step={100}
                            value={globalTempHigh}
                            onChangeValue={({ value }: { value: number }) => {
                                setGlobalTempHigh(Math.round(value))
                                saveConfig()
                            }}
                            hexpand
                        />
                    </box>

                    {/* Température nuit */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={3}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <label
                                label="Température nuit:"
                                halign={Gtk.Align.START}
                                hexpand
                            />
                            <label
                                label={globalTempLow((temp: number) => `${temp}K`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={2000}
                            max={5000}
                            step={100}
                            value={globalTempLow}
                            onChangeValue={({ value }: { value: number }) => {
                                setGlobalTempLow(Math.round(value))
                                saveConfig()
                            }}
                            hexpand
                        />
                    </box>

                    {/* Durée de transition */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={3}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <label
                                label="Transition:"
                                halign={Gtk.Align.START}
                                hexpand
                            />
                            <label
                                label={globalDuration((dur: number) => `${Math.floor(dur / 60)}min ${dur % 60}s`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={300}
                            max={3600}
                            step={60}
                            value={globalDuration}
                            onChangeValue={({ value }: { value: number }) => {
                                setGlobalDuration(Math.round(value))
                                saveConfig()
                            }}
                            hexpand
                        />
                    </box>

                    {/* Position */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <label
                                label="Position:"
                                halign={Gtk.Align.START}
                                hexpand
                            />
                            <button onClicked={detectLocation}>
                                <label label={globalLocationLoading((loading: boolean) =>
                                    loading ? "Détection..." : "Détecter"
                                )} />
                            </button>
                        </box>

                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <entry
                                text={globalLatitude((lat: number) => lat.toString())}
                                placeholderText="Latitude"
                                hexpand
                                onNotifyText={({ text }: { text: string }) => {
                                    const val = parseFloat(text)
                                    if (!isNaN(val) && val >= -90 && val <= 90) {
                                        setGlobalLatitude(val)
                                        saveConfig()
                                    }
                                }}
                                maxWidthChars={12}
                            />
                            <entry
                                text={globalLongitude((lng: number) => lng.toString())}
                                placeholderText="Longitude"
                                hexpand
                                onNotifyText={({ text }: { text: string }) => {
                                    const val = parseFloat(text)
                                    if (!isNaN(val) && val >= -180 && val <= 180) {
                                        setGlobalLongitude(val)
                                        saveConfig()
                                    }
                                }}
                                maxWidthChars={12}
                            />
                        </box>

                        {/* Buttons Appliquer et Réinitialiser */}
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6} homogeneous>
                            <button
                                onClicked={restartWlsunset}
                                hexpand
                            >
                                <label label="Appliquer" />
                            </button>
                            <button
                                onClicked={resetToDefaults}
                                hexpand
                            >
                                <label label="Réinitialiser" />
                            </button>
                        </box>
                    </box>
                </box>
            </popover>
        </menubutton>
    )
}
