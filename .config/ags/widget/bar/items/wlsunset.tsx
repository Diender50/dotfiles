import Gtk from "gi://Gtk?version=4.0"
import GLib from "gi://GLib"
import { createState, onMount } from "ags"
import { execAsync } from "ags/process"

const CONFIG_FILE = `${GLib.get_home_dir()}/.config/ags/wlsunset.json`

export function WlSunset() {
    const [isActive, setIsActive] = createState(false)
    const [tempLow, setTempLow] = createState(4000)
    const [tempHigh, setTempHigh] = createState(6500)
    const [duration, setDuration] = createState(900)
    const [latitude, setLatitude] = createState(51.6)
    const [longitude, setLongitude] = createState(7.4)
    const [locationLoading, setLocationLoading] = createState(false)

    // Valeurs par défaut
    const defaultConfig = {
        tempLow: 4000,
        tempHigh: 6500,
        duration: 900,
        latitude: 51.6,
        longitude: 7.4
    }

    // Charger les paramètres sauvegardés
    function loadConfig() {
        try {
            const configData = GLib.file_get_contents(CONFIG_FILE)[1]
            const config = JSON.parse(new TextDecoder().decode(configData))

            setTempLow(config.tempLow || defaultConfig.tempLow)
            setTempHigh(config.tempHigh || defaultConfig.tempHigh)
            setDuration(config.duration || defaultConfig.duration)
            setLatitude(config.latitude || defaultConfig.latitude)
            setLongitude(config.longitude || defaultConfig.longitude)

            console.log("Configuration wlsunset chargée")
        } catch (e) {
            console.log("Aucune configuration wlsunset trouvée, utilisation des valeurs par défaut")
        }
    }

    // Sauvegarder les paramètres
    function saveConfig() {
        try {
            const config = {
                tempLow: tempLow.get(),
                tempHigh: tempHigh.get(),
                duration: duration.get(),
                latitude: latitude.get(),
                longitude: longitude.get()
            }

            const configDir = `${GLib.get_home_dir()}/.config/ags`
            GLib.mkdir_with_parents(configDir, 0o755)

            GLib.file_set_contents(CONFIG_FILE, JSON.stringify(config, null, 2))
        } catch (e) {
            console.error("Erreur sauvegarde config:", e)
        }
    }

    // Réinitialiser aux valeurs par défaut
    function resetToDefaults() {
        setTempLow(defaultConfig.tempLow)
        setTempHigh(defaultConfig.tempHigh)
        setDuration(defaultConfig.duration)
        setLatitude(defaultConfig.latitude)
        setLongitude(defaultConfig.longitude)
        saveConfig()
        console.log("Paramètres réinitialisés aux valeurs par défaut")
    }

    // Vérifier le statut de wlsunset
    async function checkStatus() {
        try {
            await execAsync(["pgrep", "-x", "wlsunset"])
            setIsActive(true)
        } catch {
            setIsActive(false)
        }
    }

    // Toggle wlsunset
    async function toggleWlsunset() {
        try {
            if (isActive.get()) {
                await execAsync(["pkill", "-x", "wlsunset"])
                setIsActive(false)
            } else {
                execAsync([
                    "wlsunset",
                    "-l", latitude.get().toString(),
                    "-L", longitude.get().toString(),
                    "-t", tempLow.get().toString(),
                    "-T", tempHigh.get().toString(),
                    "-d", duration.get().toString()
                ]).catch(() => { })
                setIsActive(true)
            }
        } catch (e) {
            // Ignorer les erreurs
        }
    }

    // Géolocalisation automatique
    async function detectLocation() {
        setLocationLoading(true)

        try {
            const result = await execAsync([
                "curl", "-s", "-m", "10",
                "http://ip-api.com/json/?fields=lat,lon,city,country"
            ])

            const data = JSON.parse(result)
            if (data.lat && data.lon) {
                setLatitude(Math.round(data.lat * 100) / 100)
                setLongitude(Math.round(data.lon * 100) / 100)
                saveConfig()
                console.log(`Position détectée: ${data.city}, ${data.country}`)
            }
        } catch (e) {
            console.error("Erreur géolocalisation:", e)
        } finally {
            setLocationLoading(false)
        }
    }

    // Redémarrer wlsunset avec nouveaux paramètres
    async function restartWlsunset() {
        if (!isActive.get()) return

        try {
            await execAsync(["pkill", "-x", "wlsunset"])
            execAsync([
                "wlsunset",
                "-l", latitude.get().toString(),
                "-L", longitude.get().toString(),
                "-t", tempLow.get().toString(),
                "-T", tempHigh.get().toString(),
                "-d", duration.get().toString()
            ]).catch(() => { })
        } catch (e) {
            console.error("Erreur restart:", e)
        }
    }

    onMount(async () => {
        loadConfig()

        // Vérifier et démarrer wlsunset automatiquement
        try {
            await execAsync(["pgrep", "-x", "wlsunset"])
            setIsActive(true)
            console.log("wlsunset déjà actif")
        } catch {
            // wlsunset n'est pas actif, le démarrer automatiquement
            try {
                execAsync([
                    "wlsunset",
                    "-l", latitude.get().toString(),
                    "-L", longitude.get().toString(),
                    "-t", tempLow.get().toString(),
                    "-T", tempHigh.get().toString(),
                    "-d", duration.get().toString()
                ]).catch(() => { })
                setIsActive(true)
                console.log("wlsunset démarré automatiquement")
            } catch (e) {
                console.error("Erreur démarrage auto wlsunset:", e)
                setIsActive(false)
            }
        }
    })


    return (
        <menubutton class="wlsunset">
            <image
                iconName={isActive(active => active ? "weather-clear-night-symbolic" : "weather-clear-symbolic")}
                pixelSize={16}
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
                            active={isActive}
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
                                label={tempHigh(temp => `${temp}K`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={5000}
                            max={7000}
                            step={100}
                            value={tempHigh}
                            onChangeValue={({ value }) => {
                                setTempHigh(Math.round(value))
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
                                label={tempLow(temp => `${temp}K`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={2000}
                            max={5000}
                            step={100}
                            value={tempLow}
                            onChangeValue={({ value }) => {
                                setTempLow(Math.round(value))
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
                                label={duration(dur => `${Math.floor(dur / 60)}min ${dur % 60}s`)}
                                class="value-label"
                            />
                        </box>
                        <slider
                            min={300}
                            max={3600}
                            step={60}
                            value={duration}
                            onChangeValue={({ value }) => {
                                setDuration(Math.round(value))
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
                                <label label={locationLoading(loading =>
                                    loading ? "Détection..." : "Détecter"
                                )} />
                            </button>
                        </box>

                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <entry
                                text={latitude(lat => lat.toString())}
                                placeholderText="Latitude"
                                widthRequest={80}
                                onNotifyText={({ text }) => {
                                    const val = parseFloat(text)
                                    if (!isNaN(val) && val >= -90 && val <= 90) {
                                        setLatitude(val)
                                        saveConfig()
                                    }
                                }}
                                maxWidthChars={12}
                            />
                            <entry
                                text={longitude(lng => lng.toString())}
                                placeholderText="Longitude"
                                widthRequest={80}
                                onNotifyText={({ text }) => {
                                    const val = parseFloat(text)
                                    if (!isNaN(val) && val >= -180 && val <= 180) {
                                        setLongitude(val)
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
