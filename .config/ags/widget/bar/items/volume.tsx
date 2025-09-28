import AstalWp from "gi://AstalWp"
import Gtk from "gi://Gtk?version=4.0"
import { createBinding, createState, onMount } from "ags"
import { For } from "ags"
import { execAsync } from "ags/process"
import {
    icons,
    VolumeIcon,
    MicroIcon,
} from "../../../src/lib/icons";

export function Audio() {
    const wp = AstalWp.get_default()!
    const { defaultSpeaker: speaker } = wp
    const { defaultMicrophone: microphone } = wp
    
    const [availableSinks, setAvailableSinks] = createState([])
    const [availableSources, setAvailableSources] = createState([])
    const [currentSink, setCurrentSink] = createState("")
    const [currentSource, setCurrentSource] = createState("")

    function toggleMute(defaultEndpoint: AstalWp.Endpoint) {
        defaultEndpoint.set_mute(!defaultEndpoint.mute)
    }

    // Fonction pour raccourcir les noms longs
    function shortenDeviceName(name: string, maxLength: number = 35): string {
        if (name.length <= maxLength) return name
        
        let shortened = name
            .replace("Tiger Lake-H HD Audio Controller", "HD Audio")
            .replace("High Definition Audio Controller", "HD Audio")
            .replace("HDMI / DisplayPort", "HDMI/DP")
            .replace("Analog Stereo", "Analog")
            .replace("Digital Microphone", "Digital Mic")
            .replace("Headset Mono Microphone", "Headset Mic")
            .replace("Built-in Audio", "Built-in")
        
        if (shortened.length > maxLength) {
            shortened = shortened.substring(0, maxLength - 3) + "..."
        }
        
        return shortened
    }

    // Récupérer les sinks (sorties audio) avec wpctl
    async function getAvailableSinks() {
        try {
            const result = await execAsync(["wpctl", "status"])
            const lines = result.split('\n')
            
            let inSinksSection = false
            const sinks = []
            
            for (const line of lines) {
                if (line.includes('Sinks:')) {
                    inSinksSection = true
                    continue
                }
                
                if (inSinksSection && (line.includes('Sources:') || line.includes('Filters:') || line.includes('Streams:'))) {
                    break
                }
                
                if (inSinksSection && line.trim()) {
                    const match = line.match(/^\s*│\s*(\*?)\s*(\d+)\.\s+(.+?)\s+\[vol:/)
                    if (match) {
                        const [, isDefault, id, name] = match
                        const device = {
                            id: id,
                            name: name.trim(),
                            description: name.trim(),
                            shortName: shortenDeviceName(name.trim()),
                            isDefault: isDefault === '*'
                        }
                        
                        sinks.push(device)
                        
                        if (device.isDefault) {
                            setCurrentSink(device.shortName)
                        }
                    }
                }
            }
            
            setAvailableSinks(sinks)
            console.log("Sinks trouvés:", sinks.length)
        } catch (e) {
            console.error("Erreur récupération sinks:", e)
        }
    }

    // Récupérer les sources (entrées audio) avec wpctl
    async function getAvailableSources() {
        try {
            const result = await execAsync(["wpctl", "status"])
            const lines = result.split('\n')
            
            let inSourcesSection = false
            const sources = []
            
            for (const line of lines) {
                if (line.includes('Sources:')) {
                    inSourcesSection = true
                    continue
                }
                
                if (inSourcesSection && (line.includes('Filters:') || line.includes('Streams:') || line.includes('Video'))) {
                    break
                }
                
                if (inSourcesSection && line.trim() && !line.includes('.monitor')) {
                    const match = line.match(/^\s*│\s*(\*?)\s*(\d+)\.\s+(.+?)\s+\[vol:/)
                    if (match) {
                        const [, isDefault, id, name] = match
                        const device = {
                            id: id,
                            name: name.trim(),
                            description: name.trim(),
                            shortName: shortenDeviceName(name.trim()),
                            isDefault: isDefault === '*'
                        }
                        
                        sources.push(device)
                        
                        if (device.isDefault) {
                            setCurrentSource(device.shortName)
                        }
                    }
                }
            }
            
            setAvailableSources(sources)
            console.log("Sources trouvées:", sources.length)
        } catch (e) {
            console.error("Erreur récupération sources:", e)
        }
    }

    // Scanner quand un popover s'ouvre
    async function refreshAudioDevices() {
        console.log("Rafraîchissement audio")
        await getAvailableSinks()
        await getAvailableSources()
    }

    async function setDefaultSink(device) {
        try {
            console.log("Changement vers sink:", device.id, device.description)
            
            await execAsync(["wpctl", "set-default", device.id])
            
            try {
                const endpoints = wp.get_endpoints?.() || []
                const endpoint = endpoints.find(ep => ep.description === device.description)
                if (endpoint && wp.set_default_speaker) {
                    wp.set_default_speaker(endpoint)
                    console.log("Changement via AstalWp réussi")
                }
            } catch (e) {
                console.log("Pas de méthode AstalWp disponible:", e)
            }
            
            setCurrentSink(device.shortName)
            
            setTimeout(() => {
                getAvailableSinks()
            }, 1000)
            
        } catch (e) {
            console.error("Erreur changement sink:", e)
        }
    }

    async function setDefaultSource(device) {
        try {
            console.log("Changement vers source:", device.id, device.description)
            
            await execAsync(["wpctl", "set-default", device.id])
            
            try {
                const endpoints = wp.get_endpoints?.() || []
                const endpoint = endpoints.find(ep => ep.description === device.description)
                if (endpoint && wp.set_default_microphone) {
                    wp.set_default_microphone(endpoint)
                    console.log("Changement via AstalWp réussi")
                }
            } catch (e) {
                console.log("Pas de méthode AstalWp disponible:", e)
            }
            
            setCurrentSource(device.shortName)
            
            setTimeout(() => {
                getAvailableSources()
            }, 1000)
            
        } catch (e) {
            console.error("Erreur changement source:", e)
        }
    }

    onMount(() => {
        console.log("Initialisation Audio")
        getAvailableSinks()
        getAvailableSources()
    })

    function getDeviceIcon(device) {
        const name = device.description.toLowerCase()
        if (name.includes("headphone") || name.includes("headset")) {
            return "audio-headphones-symbolic"
        } else if (name.includes("speaker")) {
            return "audio-speakers-symbolic"
        } else if (name.includes("microphone") || name.includes("mic")) {
            return "audio-input-microphone-symbolic"
        } else if (name.includes("webcam") || name.includes("camera")) {
            return "camera-web-symbolic"
        } else if (name.includes("hdmi") || name.includes("displayport")) {
            return "video-display-symbolic"
        } else {
            return "audio-card-symbolic"
        }
    }

    function renderSink(device) {
        return (
            <button 
                onClicked={() => setDefaultSink(device)}
                class={device.isDefault ? "audio-device-button active" : "audio-device-button"}
                tooltipText={device.description}
            >
                <box spacing={8} hexpand>
                    <image iconName={getDeviceIcon(device)} pixelSize={16} />
                    <label 
                        label={device.shortName} 
                        hexpand 
                        halign={Gtk.Align.START}
                        maxWidthChars={30}
                    />
                    {device.isDefault && <image iconName="object-select-symbolic" pixelSize={12} />}
                </box>
            </button>
        )
    }

    function renderSource(device) {
        return (
            <button 
                onClicked={() => setDefaultSource(device)}
                class={device.isDefault ? "audio-device-button active" : "audio-device-button"}
                tooltipText={device.description}
            >
                <box spacing={8} hexpand>
                    <image iconName={getDeviceIcon(device)} pixelSize={16} />
                    <label 
                        label={device.shortName} 
                        hexpand 
                        halign={Gtk.Align.START}
                        maxWidthChars={30}
                    />
                    {device.isDefault && <image iconName="object-select-symbolic" pixelSize={12} />}
                </box>
            </button>
        )
    }

    return (
        <menubutton class="volume" >
            <Gtk.EventControllerScroll
                flags={Gtk.EventControllerScrollFlags.VERTICAL}
                onScroll={(event, dx, dy) => {
                    if (dy < 0) speaker.set_volume(speaker.volume + 0.05);
                    else if (dy > 0) speaker.set_volume(speaker.volume - 0.05);
                }}
            />
            <image iconName={VolumeIcon} pixelSize={16} />
            <popover onNotifyVisible={(popover) => {
                if (popover.visible) {
                    console.log("Popover audio ouvert - scan des appareils")
                    refreshAudioDevices()
                }
            }}>
                <box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    {/* Section Sortie Audio */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                            <button onClicked={() => toggleMute(speaker)} tooltipText="Mute speaker">
                                <image iconName={VolumeIcon} pixelSize={16} />
                            </button>
                            <slider
                                hexpand
                                onChangeValue={({ value }) => speaker.set_volume(value)}
                                value={createBinding(speaker, "volume")}
                            />
                        </box>
                        
                        {/* MenuButton pour les sorties audio */}
                        <menubutton
                            class="audio-selector-button"
                            widthRequest={280}
                        >
                            <box spacing={8} hexpand>
                                <image iconName="audio-speakers-symbolic" pixelSize={16} />
                                <label 
                                    label={currentSink(name => name || "Sortie audio")} 
                                    hexpand 
                                    halign={Gtk.Align.START}
                                    maxWidthChars={25}
                                />
                                <image iconName="pan-down-symbolic" pixelSize={12} />
                            </box>
                            
                            <popover onNotifyVisible={(popover) => {
                                if (popover.visible) {
                                    console.log("Popover sorties ouvert")
                                    getAvailableSinks()
                                }
                            }}>
                                <scrolledwindow
                                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                                    maxContentHeight={300}
                                    minContentHeight={150}
                                    propagateNaturalHeight={false}
                                    class="audio-device-list"
                                    widthRequest={280}
                                >
                                    <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                                        <label 
                                            label="Sorties audio disponibles :" 
                                            class="audio-section-title"
                                            halign={Gtk.Align.START}
                                        />
                                        <For each={availableSinks}>
                                            {device => renderSink(device)}
                                        </For>
                                    </box>
                                </scrolledwindow>
                            </popover>
                        </menubutton>
                    </box>

                    {/* Section Entrée Audio */}
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                            <button onClicked={() => toggleMute(microphone)} tooltipText="Mute microphone">
                                <image iconName={MicroIcon} pixelSize={16} />
                            </button>
                            <slider
                                hexpand
                                onChangeValue={({ value }) => microphone.set_volume(value)}
                                value={createBinding(microphone, "volume")}
                            />
                        </box>
                        
                        {/* MenuButton pour les entrées audio */}
                        <menubutton
                            class="audio-selector-button"
                            widthRequest={280}
                        >
                            <box spacing={8} hexpand>
                                <image iconName="audio-input-microphone-symbolic" pixelSize={16} />
                                <label 
                                    label={currentSource(name => name || "Entrée audio")} 
                                    hexpand 
                                    halign={Gtk.Align.START}
                                    maxWidthChars={25}
                                />
                                <image iconName="pan-down-symbolic" pixelSize={12} />
                            </box>
                            
                            <popover onNotifyVisible={(popover) => {
                                if (popover.visible) {
                                    console.log("Popover entrées ouvert")
                                    getAvailableSources()
                                }
                            }}>
                                <scrolledwindow
                                    hscrollbarPolicy={Gtk.PolicyType.NEVER}
                                    vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                                    maxContentHeight={300}
                                    minContentHeight={150}
                                    propagateNaturalHeight={false}
                                    class="audio-device-list"
                                    widthRequest={280}
                                >
                                    <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
                                        <label 
                                            label="Entrées audio disponibles :" 
                                            class="audio-section-title"
                                            halign={Gtk.Align.START}
                                        />
                                        <For each={availableSources}>
                                            {source => renderSource(source)}
                                        </For>
                                    </box>
                                </scrolledwindow>
                            </popover>
                        </menubutton>
                    </box>
                </box>
            </popover>
        </menubutton>
    )
}
