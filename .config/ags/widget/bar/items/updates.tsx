import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { createState } from "ags"

function execCommand(command: string): string {
    try {
        const [success, output] = GLib.spawn_command_line_sync(command)
        if (success && output) {
            const decoder = new TextDecoder()
            return decoder.decode(output).trim()
        }
    } catch (error) {
        console.error(`Failed to execute command: ${command}`, error)
    }
    return ""
}

// Variables simples pour le bouton
let globalInitialized = false

// States réactifs pour TOUT (bouton ET popover)
const buttonDisplayCount = createState<number>(0)
const pacmanCount = createState<number>(0)
const aurCount = createState<number>(0)
const pacmanList = createState<string>("Loading...")
const aurList = createState<string>("Loading...")

// Fonction centralisée pour mettre à jour TOUS les states
function updateAllStates() {
    console.log("=== UPDATING ALL STATES (BUTTON + POPOVER) ===")

    // Exécuter les commandes
    const pacmanOutput = execCommand("checkupdates")
    const aurOutput = execCommand("paru -Qua")

    const newPacmanCount = pacmanOutput ? pacmanOutput.split('\n').filter(line => line.trim()).length : 0
    const newAurCount = aurOutput ? aurOutput.split('\n').filter(line => line.trim()).length : 0
    const totalCount = newPacmanCount + newAurCount

    // Mettre à jour TOUS les states en une fois
    buttonDisplayCount[1](totalCount)
    pacmanCount[1](newPacmanCount)
    aurCount[1](newAurCount)
    pacmanList[1](pacmanOutput || "No pacman updates available")
    aurList[1](aurOutput || "No AUR updates available")

    console.log(`Updated all states: ${newPacmanCount} pacman, ${newAurCount} AUR, total: ${totalCount}`)
}

export function Updates() {
    // Check unique au démarrage
    if (!globalInitialized) {
        globalInitialized = true
        console.log("Updates widget initialized ONCE")

        setTimeout(() => {
            console.log("Delayed initial check...")
            updateAllStates()
        }, 5000)
    }

    // Poll pour le bouton - utilise maintenant le state réactif
    const buttonText = createPoll("󰏔 ...", 3600000, () => {
        console.log("Hourly update check...")
        updateAllStates()

        // Retourner la valeur actuelle du state
        const count = buttonDisplayCount[0].get()
        return count === 0 ? "󰏔 0" : `󰏔 ${count}`
    })

    // Poll rapide pour le bouton - utilise le state réactif
    const quickUpdate = createPoll("", 2000, () => {
        const count = buttonDisplayCount[0].get()
        if (count > 0) {
            return `󰏔 ${count}`
        }
        return count === 0 ? "󰏔 0" : ""
    })

    return (
        <menubutton class="updates">
            <label label={buttonDisplayCount[0]((count) => {
                if (count === 0) return "󰏔 0"
                if (count > 0) return `󰏔 ${count}`
                return "󰏔 ..."
            })} />

            <popover>
                <box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    class="updates-popover"
                >
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <box spacing={4}>
                            <image iconName="system-software-update-symbolic" pixelSize={16} />
                            <label
                                label={pacmanCount[0]((count) => `Pacman Updates (${count})`)}
                                class="update-section-title"
                            />
                            <button
                                onClicked={() => {
                                    console.log("Launching pacman update...")
                                    GLib.spawn_command_line_async("ghostty sudo pacman -Syu --noconfirm")

                                    // Auto-refresh après 10 secondes (plus raisonnable)
                                    setTimeout(() => {
                                        console.log("Auto-refresh after pacman update...")
                                        updateAllStates()
                                    }, 600000)
                                }}
                                hexpand
                                halign={Gtk.Align.END}
                            >
                                <box spacing={4}>
                                    <image iconName="system-software-install-symbolic" pixelSize={12} />
                                    <label label="Update" />
                                </box>
                            </button>
                        </box>

                        <Gtk.ScrolledWindow
                            class="package-list-scroll"
                            heightRequest={80}
                            widthRequest={250}
                            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                            hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        >
                            <label
                                label={pacmanList[0]((list) => list)}
                                halign={Gtk.Align.START}
                                valign={Gtk.Align.START}
                                wrap={false}
                                selectable
                                class="package-list"
                            />
                        </Gtk.ScrolledWindow>
                    </box>

                    <Gtk.Separator />

                    {/* Section AUR */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                        <box spacing={4}>
                            <image iconName="package-x-generic-symbolic" pixelSize={16} />
                            <label
                                label={aurCount[0]((count) => `AUR Updates (${count})`)}
                                class="update-section-title"
                            />
                            <button
                                onClicked={() => {
                                    console.log("Launching AUR update...")
                                    GLib.spawn_command_line_async("ghostty paru -Syu --noconfirm")

                                    // Auto-refresh après 15 secondes (AUR prEND plus de temps)
                                    setTimeout(() => {
                                        console.log("Auto-refresh after AUR update...")
                                        updateAllStates()
                                    }, 600000)
                                }}
                                hexpand
                                halign={Gtk.Align.END}
                            >
                                <box spacing={4}>
                                    <image iconName="system-software-install-symbolic" pixelSize={12} />
                                    <label label="Update" />
                                </box>
                            </button>
                        </box>

                        <Gtk.ScrolledWindow
                            class="package-list-scroll"
                            heightRequest={80}
                            widthRequest={250}
                            vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                            hscrollbarPolicy={Gtk.PolicyType.NEVER}
                        >
                            <label
                                label={aurList[0]((list) => list)}
                                halign={Gtk.Align.START}
                                valign={Gtk.Align.START}
                                wrap={false}
                                selectable
                                class="package-list"
                            />
                        </Gtk.ScrolledWindow>
                    </box>

                    {/* Actions globales */}
                    <Gtk.Separator />
                    <label
                        label="Pacman: 10m  • AUR: 10m  • All: 20m"
                        class="help-text"
                        css="font-size: 0.8em; opacity: 0.6;"
                    />
                    <box spacing={8}>
                        <button
                            hexpand
                            class="refresh-button"
                            onClicked={() => {
                                console.log("=== MANUAL REFRESH CLICKED ===")
                                updateAllStates()
                            }}
                        >
                            <box spacing={4} halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER} >
                                <image iconName="view-refresh-symbolic" pixelSize={12} />
                                <label label="Refresh" />
                            </box>
                        </button>
                        <button
                            hexpand
                            class="global-update-button"
                            onClicked={() => {
                                console.log("Launching global update...")
                                GLib.spawn_command_line_async("ghostty bash -c 'sudo pacman -Syu && paru -Syu'")

                                // Auto-refresh après 20 secondes (le plus long)
                                setTimeout(() => {
                                    console.log("Auto-refresh after global update...")
                                    updateAllStates()
                                }, 1200000)
                            }}
                        >

                            <box spacing={4} halign={Gtk.Align.CENTER}
                                valign={Gtk.Align.CENTER}>
                                <image iconName="system-software-update-symbolic" pixelSize={16} />
                                <label label="Update All" />
                            </box>
                        </button>
                    </box>
                </box>
            </popover>
        </menubutton>
    )
}
