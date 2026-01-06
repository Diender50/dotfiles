import AstalWp from "gi://AstalWp";
import Gtk from "gi://Gtk?version=4.0";
import { createBinding, createState, createComputed, onMount, For } from "ags";
import { execAsync } from "ags/process";
import {
  VolumeGlyph,
  MicroGlyph,
  getDeviceGlyph,
} from "../../../src/lib/glyphs";


export function Audio() {
  const wp = AstalWp.get_default()!;
  const speaker = wp.audio.defaultSpeaker!;
  const microphone = wp.audio.defaultMicrophone!;


  const [availableSinks, setAvailableSinks] = createState<any[]>([]);
  const [availableSources, setAvailableSources] = createState<any[]>([]);
  const [currentSink, setCurrentSink] = createState<any>(null);
  const [currentSource, setCurrentSource] = createState<any>(null);


  function toggleMute(endpoint: AstalWp.Endpoint) {
    endpoint.set_mute(!endpoint.mute);
  }


  function shortenDeviceName(name: string, maxLength: number = 35): string {
    if (name.length <= maxLength) return name;
    let shortened = name
      .replace("Tiger Lake-H HD Audio Controller", "HD Audio")
      .replace("High Definition Audio Controller", "HD Audio")
      .replace("HDMI / DisplayPort", "HDMI/DP")
      .replace("Analog Stereo", "Analog")
      .replace("Digital Microphone", "Digital Mic")
      .replace("Headset Mono Microphone", "Headset Mic")
      .replace("Built-in Audio", "Built-in");
    if (shortened.length > maxLength) shortened = shortened.substring(0, maxLength - 3) + "...";
    return shortened;
  }


  async function getAvailableSinks() {
    try {
      const result = await execAsync(["wpctl", "status"]);
      const lines = result.split("\n");
      let inSinksSection = false;
      const sinks: any[] = [];
      for (const line of lines) {
        if (line.includes("Sinks:")) {
          inSinksSection = true;
          continue;
        }
        if (inSinksSection && (line.includes("Sources:") || line.includes("Filters:") || line.includes("Streams:"))) {
          break;
        }
        if (inSinksSection && line.trim()) {
          const match = line.match(/^\s*│\s*(\*?)\s*(\d+)\.\s+(.+?)\s+\[vol:/);
          if (match) {
            const [, isDefault, id, name] = match;
            const device = {
              id,
              name: name.trim(),
              description: name.trim(),
              shortName: shortenDeviceName(name.trim()),
              isDefault: isDefault === "*",
            };
            sinks.push(device);
            if (device.isDefault) setCurrentSink(device);
          }
        }
      }
      setAvailableSinks(sinks);
    } catch (e) {
      console.error("Erreur récupération sinks:", e);
    }
  }


  async function getAvailableSources() {
    try {
      const result = await execAsync(["wpctl", "status"]);
      const lines = result.split("\n");
      let inSourcesSection = false;
      const sources: any[] = [];
      for (const line of lines) {
        if (line.includes("Sources:")) {
          inSourcesSection = true;
          continue;
        }
        if (inSourcesSection && (line.includes("Filters:") || line.includes("Streams:") || line.includes("Video"))) {
          break;
        }
        if (inSourcesSection && line.trim() && !line.includes(".monitor")) {
          const match = line.match(/^\s*│\s*(\*?)\s*(\d+)\.\s+(.+?)\s+\[vol:/);
          if (match) {
            const [, isDefault, id, name] = match;
            const device = {
              id,
              name: name.trim(),
              description: name.trim(),
              shortName: shortenDeviceName(name.trim()),
              isDefault: isDefault === "*",
            };
            sources.push(device);
            if (device.isDefault) setCurrentSource(device);
          }
        }
      }
      setAvailableSources(sources);
    } catch (e) {
      console.error("Erreur récupération sources:", e);
    }
  }


  async function refreshAudioDevices() {
    await getAvailableSinks();
    await getAvailableSources();
  }


  async function setDefaultSink(device: any) {
    try {
      await execAsync(["wpctl", "set-default", device.id]);
      setCurrentSink(device);
      setTimeout(() => getAvailableSinks(), 1000);
    } catch (e) {
      console.error("Erreur changement sink:", e);
    }
  }


  async function setDefaultSource(device: any) {
    try {
      await execAsync(["wpctl", "set-default", device.id]);
      setCurrentSource(device);
      setTimeout(() => getAvailableSources(), 1000);
    } catch (e) {
      console.error("Erreur changement source:", e);
    }
  }


  function renderSink(device: any) {
    return (
      <button
        onClicked={() => setDefaultSink(device)}
        class={device.isDefault ? "audio-device-button active" : "audio-device-button"}
        tooltipText={device.description}
      >
        <box spacing={8} hexpand>
          <label label={getDeviceGlyph(device)} class="audio-device-icon" />
          <label label={device.shortName} hexpand halign={Gtk.Align.START} maxWidthChars={30} />
          {device.isDefault && <label label="✔" class="audio-device-selected-icon" />}
        </box>
      </button>
    );
  }


  function renderSource(device: any) {
    return (
      <button
        onClicked={() => setDefaultSource(device)}
        class={device.isDefault ? "audio-device-button active" : "audio-device-button"}
        tooltipText={device.description}
      >
        <box spacing={8} hexpand>
          <label label={getDeviceGlyph(device)} class="audio-device-icon" />
          <label label={device.shortName} hexpand halign={Gtk.Align.START} maxWidthChars={30} />
          {device.isDefault && <label label="✔" class="audio-device-selected-icon" />}
        </box>
      </button>
    );
  }


  onMount(() => {
    refreshAudioDevices();
  });


  const percentBinding = createBinding(speaker, "volume")((vol: number) => 
    `${Math.floor(vol * 100)}%`
  );


  const glyphAndPercentBinding = createComputed([VolumeGlyph, percentBinding])(
    (values) => {
      const [glyph, percent] = values;
      return `${glyph} ${percent}`;
    }
  );


  return (
    <menubutton class="volume">
      <Gtk.EventControllerScroll
        flags={Gtk.EventControllerScrollFlags.VERTICAL}
        onScroll={(event, dx, dy) => {
          if (dy < 0) speaker.set_volume(speaker.volume + 0.05);
          else if (dy > 0) speaker.set_volume(speaker.volume - 0.05);
        }}
      />
      <label label={glyphAndPercentBinding} class="volume-glyph" />


      <popover onNotifyVisible={(popover) => popover.visible && refreshAudioDevices()}>
        <box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
          <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
              <button onClicked={() => toggleMute(speaker)} tooltipText="Mute speaker">
                <label label={VolumeGlyph} class="volume-glyph" />
              </button>
              <slider
                hexpand
                onChangeValue={({ value }) => speaker.set_volume(value)}
                value={createBinding(speaker, "volume")}
              />
            </box>
            <menubutton class="audio-selector-button" widthRequest={280}>
              <box spacing={8} hexpand>
                <label 
                  label={currentSink((device: any) => device ? getDeviceGlyph(device) : "墳")} 
                  class="audio-device-icon" 
                />
                <label 
                  label={currentSink((device: any) => device ? device.shortName : "Sortie audio")} 
                  hexpand 
                  halign={Gtk.Align.START} 
                  maxWidthChars={25} 
                />
                <label label={"▾"} class="audio-select-arrow" />
              </box>
              <popover onNotifyVisible={(popover) => popover.visible && getAvailableSinks()}>
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
                    <label label="Sorties audio disponibles :" class="audio-section-title" halign={Gtk.Align.START} />
                    <For each={availableSinks}>{renderSink}</For>
                  </box>
                </scrolledwindow>
              </popover>
            </menubutton>
          </box>
          <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
            <box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
              <button onClicked={() => toggleMute(microphone)} tooltipText="Mute microphone">
                <label label={MicroGlyph} class="microphone-glyph" />
              </button>
              <slider
                hexpand
                onChangeValue={({ value }) => microphone.set_volume(value)}
                value={createBinding(microphone, "volume")}
              />
            </box>
            <menubutton class="audio-selector-button" widthRequest={280}>
              <box spacing={8} hexpand>
                <label 
                  label={currentSource((device: any) => device ? getDeviceGlyph(device) : "")} 
                  class="microphone-glyph" 
                />
                <label 
                  label={currentSource((device: any) => device ? device.shortName : "Entrée audio")} 
                  hexpand 
                  halign={Gtk.Align.START} 
                  maxWidthChars={25} 
                />
                <label label={"▾"} class="audio-select-arrow" />
              </box>
              <popover onNotifyVisible={(popover) => popover.visible && getAvailableSources()}>
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
                    <label label="Entrées audio disponibles :" class="audio-section-title" halign={Gtk.Align.START} />
                    <For each={availableSources}>{renderSource}</For>
                  </box>
                </scrolledwindow>
              </popover>
            </menubutton>
          </box>
        </box>
      </popover>
    </menubutton>
  );
}
