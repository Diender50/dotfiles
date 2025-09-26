import AstalWp from "gi://AstalWp"
import Gtk from "gi://Gtk?version=4.0"
import { createBinding } from "ags"
import {
    icons,
    VolumeIcon,
    MicroIcon,
} from "../../../src/lib/icons";

export function Audio() {
    const { defaultSpeaker: speaker } = AstalWp.get_default()!
    const { defaultMicrophone: microphone } = AstalWp.get_default()!

    function toggleMute(defaultEndpoint: AstalWp.Endpoint) {
        defaultEndpoint.set_mute(!defaultEndpoint.mute)
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
            <popover>
                <box orientation={Gtk.Orientation.VERTICAL}>
                    <box spacing={3}>
                        <button onClicked={() => toggleMute(speaker)} tooltipText="Mute speaker">
                            <image iconName={VolumeIcon} pixelSize={16} />
                        </button>
                        <slider
                            widthRequest={220}
                            onChangeValue={({ value }) => speaker.set_volume(value)}
                            value={createBinding(speaker, "volume")}
                        />
                    </box>
                    <box spacing={3}>
                        <button onClicked={() => toggleMute(microphone)} tooltipText="Mute microphone">
                            <image iconName={MicroIcon} pixelSize={16} />
                        </button>
                        <slider
                            widthRequest={220}
                            onChangeValue={({ value }) => microphone.set_volume(value)}
                            value={createBinding(microphone, "volume")}
                        />
                    </box>
                </box>
            </popover>
        </menubutton>
    )
}