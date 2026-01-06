import Gio from "gi://Gio?version=2.0";
import { createState, For } from "ags";
import AstalIO from "gi://AstalIO?version=0.1";
import { interval } from "ags/time"
import GLib from "gi://GLib?version=2.0";
import Gtk from "gi://Gtk?version=4.0"
import { glyphs } from "../../../src/lib/glyphs"

export enum PlaybackStatus {
    Playing = "Playing",
    Paused = "Paused",
    Stopped = "Stopped"
}

const coverCache = new Map<string, string>();
const maxCacheSize = 20;
let cacheCleanupTimer: AstalIO.Time | null = null;

function cleanupCache() {
    const cacheDir = GLib.get_user_cache_dir() + "/ags-mpris-covers";

    try {
        const dir = Gio.File.new_for_path(cacheDir);
        if (!dir.query_exists(null)) return;

        const enumerator = dir.enumerate_children(
            "standard::name,time::modified",
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        const files: Array<{ name: string, time: number }> = [];

        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            const modTime = info.get_modification_date_time()?.to_unix() || 0;
            files.push({ name, time: modTime });
        }

        files.sort((a, b) => a.time - b.time);

        if (files.length > maxCacheSize) {
            const toDelete = files.slice(0, files.length - maxCacheSize);
            for (const file of toDelete) {
                try {
                    const fileToDelete = dir.get_child(file.name);
                    fileToDelete.delete(null);
                    console.log("Deleted old cover cache:", file.name);
                } catch (e) {
                    console.error("Error deleting cache file:", e);
                }
            }
        }
    } catch (e) {
        console.error("Error cleaning cache:", e);
    }
}

if (!cacheCleanupTimer) {
    cacheCleanupTimer = interval(300000, cleanupCache);
}

async function downloadCover(url: string): Promise<string | null> {
    if (coverCache.has(url)) {
        return coverCache.get(url)!;
    }

    try {
        const urlHash = GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, url, -1);
        const cacheDir = GLib.get_user_cache_dir() + "/ags-mpris-covers";
        const cachePath = `${cacheDir}/${urlHash}.jpg`;

        GLib.mkdir_with_parents(cacheDir, 0o755);

        if (GLib.file_test(cachePath, GLib.FileTest.EXISTS)) {
            coverCache.set(url, cachePath);
            const file = Gio.File.new_for_path(cachePath);
            file.set_attribute_uint64(
                "time::modified",
                GLib.get_real_time(),
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            return cachePath;
        }

        if (coverCache.size >= maxCacheSize) {
            cleanupCache();
        }

        console.log("Downloading cover:", url);

        const file = Gio.File.new_for_uri(url);
        const outputFile = Gio.File.new_for_path(cachePath);

        file.copy_async(
            outputFile,
            Gio.FileCopyFlags.OVERWRITE,
            GLib.PRIORITY_DEFAULT,
            null,
            null,
            (source, result) => {
                try {
                    file.copy_finish(result);
                    coverCache.set(url, cachePath);
                    console.log("Cover downloaded:", cachePath);
                } catch (e) {
                    console.error("Failed to download cover:", e);
                }
            }
        );

        return null;
    } catch (e) {
        console.error("Error downloading cover:", e);
        return null;
    }
}

export class Player {
    busName: string;
    rootProxy: Gio.DBusProxy | null;
    proxy: Gio.DBusProxy | null;
    isPrimaryPlayer: boolean

    identity = createState<string>("Unknown Player");
    playbackStatus = createState<PlaybackStatus>(PlaybackStatus.Stopped);
    position = createState(0);
    trackLength = createState(0);
    title = createState<string>("No Track");
    artist = createState<string>("No Artist");
    album = createState<string>("No Album");
    coverArt = createState<string>("");
    localCoverPath = createState<string>("");
    displayText = createState<string>("No Track");
    canGoPrevious = createState(false);
    canGoNext = createState(false);
    canControl = createState(false);
    canSeek = createState(false);

    private basePosition: number = 0;
    private startTime: number = 0;
    private isLocallyPlaying: boolean = false;
    private estimationTimer: AstalIO.Time | null = null;

    constructor(busName: string, isPrimary: boolean) {
        this.busName = busName;
        this.rootProxy = null;
        this.proxy = null;
        this.estimationTimer = null;
        this.isPrimaryPlayer = isPrimary

        this._initRootProxy()
        this._initProxy();
        this._startLocalEstimation();
    }

    public destroy() {
        this.estimationTimer?.cancel();
    }

    private _updateDisplayText() {
        const title = this.title[0].get();
        const artist = this.artist[0].get();
        const text = artist !== "Unknown Artist" ? `${title} - ${artist}` : title;
        this.displayText[1](text);
    }

    private _startLocalEstimation() {
        this.estimationTimer = interval(200, () => {
            if (this.isLocallyPlaying) {
                const now = Date.now();
                const elapsed = (now - this.startTime) / 1000;
                const currentPos = this.basePosition + elapsed;
                const maxPos = this.trackLength[0].get();

                if (maxPos > 0 && currentPos <= maxPos) {
                    this.position[1](currentPos);
                } else if (maxPos > 0) {
                    this.position[1](maxPos);
                    this.isLocallyPlaying = false;
                }
            }
        });
    }

    private _resetEstimation(newPosition: number, isPlaying: boolean) {
        this.basePosition = newPosition;
        this.startTime = Date.now();
        this.isLocallyPlaying = isPlaying;
        this.position[1](newPosition);
    }

    private async _processCoverArt(artUrl: string) {
        this.coverArt[1](artUrl);

        const oldCover = this.localCoverPath[0].get();
        if (oldCover && oldCover !== artUrl) {
            this.localCoverPath[1]("");
        }

        if (artUrl && (artUrl.startsWith('http://') || artUrl.startsWith('https://'))) {
            const localPath = await downloadCover(artUrl);
            if (localPath) {
                this.localCoverPath[1](localPath);
            } else {
                setTimeout(async () => {
                    const retryPath = coverCache.get(artUrl);
                    if (retryPath && GLib.file_test(retryPath, GLib.FileTest.EXISTS)) {
                        this.localCoverPath[1](retryPath);
                    }
                }, 2000);
            }
        } else if (artUrl) {
            if (artUrl.startsWith('file://')) {
                artUrl = artUrl.substring(7);
            }
            this.localCoverPath[1](artUrl);
        } else {
            this.localCoverPath[1]("");
        }
    }

    private _initRootProxy(): void {
        try {
            this.rootProxy = Gio.DBusProxy.new_sync(
                Gio.DBus.session,
                Gio.DBusProxyFlags.NONE,
                null,
                this.busName,
                "/org/mpris/MediaPlayer2",
                "org.mpris.MediaPlayer2",
                null
            );
        } catch (e) {
            console.error(`Error creating root proxy for ${this.busName}`);
            return;
        }

        const idVar = this.rootProxy.get_cached_property("Identity");
        this.identity[1](idVar ? (idVar.deep_unpack() as string) : this.busName.replace("org.mpris.MediaPlayer2.", ""));
    }

    private _initProxy(): void {
        try {
            this.proxy = Gio.DBusProxy.new_sync(
                Gio.DBus.session,
                Gio.DBusProxyFlags.NONE,
                null,
                this.busName,
                "/org/mpris/MediaPlayer2",
                "org.mpris.MediaPlayer2.Player",
                null
            );
        } catch (e) {
            console.error(`Error creating player proxy for ${this.busName}`);
            return;
        }

        this.proxy.connect("g-properties-changed", (proxy: Gio.DBusProxy, changed: GLib.Variant) => {
            this._onPropertiesChanged(changed);
        });

        this._updateAllProperties();
    }

    private _updateAllProperties(): void {
        if (!this.proxy) return;

        const metaVariant = this.proxy.get_cached_property("Metadata");
        if (metaVariant) {
            try {
                let meta: any = metaVariant.deep_unpack();
                this.title[1](meta["xesam:title"]?.deep_unpack() || "Unknown Track");
                this.album[1](meta["xesam:album"]?.deep_unpack() || "Unknown Album");

                if (meta["xesam:artist"]) {
                    const artistData = meta["xesam:artist"].deep_unpack();
                    this.artist[1](Array.isArray(artistData) ? artistData.join(", ") : String(artistData) || "Unknown Artist");
                } else {
                    this.artist[1]("Unknown Artist");
                }

                this._updateDisplayText();

                if (meta["mpris:artUrl"]) {
                    let artUrl = meta["mpris:artUrl"].deep_unpack();
                    this._processCoverArt(artUrl);
                } else {
                    this.coverArt[1]("");
                    this.localCoverPath[1]("");
                }

                if (meta["mpris:length"]) {
                    let lengthNumber = meta["mpris:length"].deep_unpack() as number / 1000000;
                    this.trackLength[1](Math.max(0, lengthNumber));
                }
            } catch (e) {
                console.error("Error processing metadata:", e);
            }
        }

        const pbVar = this.proxy.get_cached_property("PlaybackStatus");
        if (pbVar) {
            try {
                let pbStr = pbVar.deep_unpack() as string;
                this.playbackStatus[1](pbStr as PlaybackStatus);
                this.isLocallyPlaying = (pbStr === PlaybackStatus.Playing);
            } catch (e) {
                this.playbackStatus[1](PlaybackStatus.Stopped);
                this.isLocallyPlaying = false;
            }
        }

        const posVar = this.proxy.get_cached_property("Position");
        if (posVar) {
            try {
                let posNumber = posVar.deep_unpack() as number / 1000000;
                this._resetEstimation(Math.max(0, posNumber), this.isLocallyPlaying);
            } catch (e) {
                this._resetEstimation(0, false);
            }
        }

        const canGoPrevVar = this.proxy.get_cached_property("CanGoPrevious");
        this.canGoPrevious[1](canGoPrevVar ? canGoPrevVar.deep_unpack() as boolean : false);

        const canGoNextVar = this.proxy.get_cached_property("CanGoNext");
        this.canGoNext[1](canGoNextVar ? canGoNextVar.deep_unpack() as boolean : false);

        const canControlVar = this.proxy.get_cached_property("CanControl");
        this.canControl[1](canControlVar ? canControlVar.deep_unpack() as boolean : false);

        const canSeekVar = this.proxy.get_cached_property("CanSeek");
        this.canSeek[1](canSeekVar ? canSeekVar.deep_unpack() as boolean : false);
    }

    private _onPropertiesChanged(changed: GLib.Variant): void {
        let dict: any = changed.deep_unpack();

        if ("Metadata" in dict) {
            let metaVariant = dict["Metadata"];
            try {
                let meta: any = metaVariant.deep_unpack();
                this.title[1](meta["xesam:title"]?.deep_unpack() || "Unknown Track");
                this.album[1](meta["xesam:album"]?.deep_unpack() || "Unknown Album");

                if (meta["xesam:artist"]) {
                    const artistData = meta["xesam:artist"].deep_unpack();
                    this.artist[1](Array.isArray(artistData) ? artistData.join(", ") : String(artistData) || "Unknown Artist");
                } else {
                    this.artist[1]("Unknown Artist");
                }

                this._updateDisplayText();

                if (meta["mpris:artUrl"]) {
                    let artUrl = meta["mpris:artUrl"].deep_unpack();
                    this._processCoverArt(artUrl);
                } else {
                    this.coverArt[1]("");
                    this.localCoverPath[1]("");
                }

                if (meta["mpris:length"]) {
                    let lengthNumber = meta["mpris:length"].deep_unpack() as number / 1000000;
                    this.trackLength[1](Math.max(0, lengthNumber));
                }

                this._resetEstimation(0, this.isLocallyPlaying);
            } catch (e) {
                // Ignore
            }
        }

        if ("PlaybackStatus" in dict) {
            try {
                let pbStr = dict["PlaybackStatus"].deep_unpack() as string;
                this.playbackStatus[1](pbStr as PlaybackStatus);

                const wasPlaying = this.isLocallyPlaying;
                const isNowPlaying = (pbStr === PlaybackStatus.Playing);

                if (wasPlaying !== isNowPlaying) {
                    const currentEstimatedPos = wasPlaying ?
                        this.basePosition + (Date.now() - this.startTime) / 1000 :
                        this.basePosition;

                    this._resetEstimation(currentEstimatedPos, isNowPlaying);
                }
            } catch (e) {
                this.playbackStatus[1](PlaybackStatus.Stopped);
                this.isLocallyPlaying = false;
            }
        }

        if ("Position" in dict) {
            try {
                let posNumber = dict["Position"].deep_unpack() as number / 1000000;
                this._resetEstimation(Math.max(0, posNumber), this.isLocallyPlaying);
            } catch (e) {
                // Ignore
            }
        }

        if ("CanGoPrevious" in dict) {
            try {
                this.canGoPrevious[1](dict["CanGoPrevious"].deep_unpack() as boolean);
            } catch (e) {
                this.canGoPrevious[1](false);
            }
        }

        if ("CanGoNext" in dict) {
            try {
                this.canGoNext[1](dict["CanGoNext"].deep_unpack() as boolean);
            } catch (e) {
                this.canGoNext[1](false);
            }
        }

        if ("CanControl" in dict) {
            try {
                this.canControl[1](dict["CanControl"].deep_unpack() as boolean);
            } catch (e) {
                this.canControl[1](false);
            }
        }

        if ("CanSeek" in dict) {
            try {
                this.canSeek[1](dict["CanSeek"].deep_unpack() as boolean);
            } catch (e) {
                this.canSeek[1](false);
            }
        }
    }

    public playPause(): void {
        if (!this.proxy) return;

        this.proxy.call(
            "PlayPause",
            new GLib.Variant("()", []),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    }

    public nextTrack(): void {
        if (!this.proxy) return;

        this.proxy.call(
            "Next",
            new GLib.Variant("()", []),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    }

    public previousTrack(): void {
        if (!this.proxy) return;

        this.proxy.call(
            "Previous",
            new GLib.Variant("()", []),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    }

    public seek(offsetSeconds: number): void {
        if (!this.proxy || !this.canSeek[0].get()) return;

        let parameters = new GLib.Variant("(x)", [offsetSeconds * 1000000]);

        const currentPos = this.isLocallyPlaying ?
            this.basePosition + (Date.now() - this.startTime) / 1000 :
            this.basePosition;
        const newPos = Math.max(0, Math.min(currentPos + offsetSeconds, this.trackLength[0].get()));
        this._resetEstimation(newPos, this.isLocallyPlaying);

        this.proxy.call(
            "Seek",
            parameters,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            null
        );
    }
}

export class MprisManager {
    private static _instance: MprisManager | null = null;

    static get_default(): MprisManager {
        if (MprisManager._instance === null) {
            MprisManager._instance = new MprisManager();
        }
        return MprisManager._instance;
    }

    players = createState<Player[]>([]);
    private availablePlayers = new Map<string, Player>();
    private pauseTimeoutId: AstalIO.Time | null = null;
    private statusCheckTimer: AstalIO.Time | null = null;
    private lastCurrentPlayerStatus: PlaybackStatus = PlaybackStatus.Stopped;
    private readonly PAUSE_TIMEOUT = 5000;
    private readonly CHECK_INTERVAL = 1000;

    constructor() {
        this._watchNameOwnerChanges();
        this._loadExistingPlayers();
        this._startStatusMonitoring();
    }

    private _startStatusMonitoring(): void {
        this.statusCheckTimer = interval(this.CHECK_INTERVAL, () => {
            this._checkPlayerStatuses();
        });
    }

    private _checkPlayerStatuses(): void {
        const currentPlayers = this.players[0].get();

        if (currentPlayers.length === 0) return;

        const currentPlayer = currentPlayers[0];
        const currentStatus = currentPlayer.playbackStatus[0].get();

        if (currentStatus !== this.lastCurrentPlayerStatus) {
            console.log(`Current player status changed: ${this.lastCurrentPlayerStatus} -> ${currentStatus}`);

            if (currentStatus === PlaybackStatus.Paused || currentStatus === PlaybackStatus.Stopped) {
                if (this.lastCurrentPlayerStatus === PlaybackStatus.Playing) {
                    console.log("Current player paused, starting timeout...");
                    this._startPauseTimeout();
                }
            } else if (currentStatus === PlaybackStatus.Playing) {
                if (this.pauseTimeoutId !== null) {
                    console.log("Current player resumed, canceling timeout");
                    this._cancelPauseTimeout();
                }
            }

            this.lastCurrentPlayerStatus = currentStatus;
        }

        if (currentStatus === PlaybackStatus.Paused || currentStatus === PlaybackStatus.Stopped) {
            for (const [busName, player] of this.availablePlayers) {
                if (busName === currentPlayer.busName) continue;

                const otherStatus = player.playbackStatus[0].get();
                if (otherStatus === PlaybackStatus.Playing) {
                    console.log(`Found playing player while current is paused: ${busName}`);
                    this._switchToPlayer(busName);
                    return;
                }
            }
        }
    }

    private _loadExistingPlayers(): void {
        Gio.DBus.session.call(
            "org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus",
            "ListNames",
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (connection, res, data) => {
                try {
                    let result: GLib.Variant = Gio.DBus.session.call_finish(res);
                    // @ts-ignore
                    let names: string[] = result.deep_unpack()[0]
                    for (let name of names) {
                        if (name.startsWith("org.mpris.MediaPlayer2")) {
                            this._createPlayerInstance(name);
                        }
                    }
                    this._selectBestPlayer();
                } catch (e) {
                    console.error(e);
                }
            }
        );
    }

    private _watchNameOwnerChanges(): void {
        Gio.DBus.session.signal_subscribe(
            null,
            "org.freedesktop.DBus",
            "NameOwnerChanged",
            "/org/freedesktop/DBus",
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, senderName, objectPath, interfaceName, signalName, parameters) => {
                // @ts-ignore
                let [name, oldOwner, newOwner] = parameters.deep_unpack();
                if (!name.startsWith("org.mpris.MediaPlayer2")) return;

                if (newOwner !== "") {
                    this._createPlayerInstance(name);
                    this._selectBestPlayer();
                } else {
                    this._destroyPlayerInstance(name);
                }
            }
        );
    }

    private _createPlayerInstance(busName: string): void {
        if (this.availablePlayers.has(busName)) return;

        try {
            const player = new Player(busName, false);
            this.availablePlayers.set(busName, player);
            console.log("Created player instance:", busName);
        } catch (e) {
            console.error("Failed to create player instance:", busName, e);
        }
    }

    private _startPauseTimeout(): void {
        this._cancelPauseTimeout();

        console.log(`Starting pause timeout: ${this.PAUSE_TIMEOUT}ms`);
        this.pauseTimeoutId = interval(this.PAUSE_TIMEOUT, () => {
            console.log("⏰ Pause timeout reached! Checking for active players...");
            this._checkForActivePlayerAfterTimeout();
            if (this.pauseTimeoutId) {
                this.pauseTimeoutId.cancel();
                this.pauseTimeoutId = null;
            }
        });
    }

    private _cancelPauseTimeout(): void {
        if (this.pauseTimeoutId !== null) {
            console.log("Canceling pause timeout");
            this.pauseTimeoutId.cancel();
            this.pauseTimeoutId = null;
        }
    }

    private _checkForActivePlayerAfterTimeout(): void {
        console.log("🔍 Checking for active players after timeout...");

        for (const [busName, player] of this.availablePlayers) {
            const status = player.playbackStatus[0].get();
            console.log(`  ${busName}: ${status}`);
        }

        const playersByPriority = Array.from(this.availablePlayers.entries())
            .sort(([a], [b]) => this._getPlayerPriority(a) - this._getPlayerPriority(b));

        for (const [busName, player] of playersByPriority) {
            const status = player.playbackStatus[0].get();

            if (status === PlaybackStatus.Playing) {
                console.log(`🎵 Found active player: ${busName}, switching!`);
                this._switchToPlayer(busName);
                return;
            }
        }

        console.log("❌ No active players found, keeping current");
    }

    private _switchToPlayer(busName: string): void {
        const player = this.availablePlayers.get(busName);
        if (!player) {
            console.log(`Player ${busName} not found in available players`);
            return;
        }

        this._cancelPauseTimeout();
        this.players[1]([player]);
        this.lastCurrentPlayerStatus = player.playbackStatus[0].get();
        console.log("✅ Switched to player:", busName);
    }

    private _destroyPlayerInstance(busName: string): void {
        const player = this.availablePlayers.get(busName);
        if (player) {
            player.destroy();
            this.availablePlayers.delete(busName);

            const currentPlayers = this.players[0].get();
            if (currentPlayers.length > 0 && currentPlayers[0].busName === busName) {
                this.players[1]([]);
                this._selectBestPlayer();
            }

            console.log("Destroyed player instance:", busName);
        }
    }

    private _getPlayerPriority(busName: string): number {
        const priorities: Record<string, number> = {
            'feishin': 1,
            'supersonic': 2,
            'floorp': 3,
            'zen': 4,
            'firefox': 5,
        };

        for (const [key, priority] of Object.entries(priorities)) {
            if (busName.toLowerCase().includes(key)) {
                return priority;
            }
        }
        return 999;
    }

    private _selectBestPlayer(): void {
        if (this.availablePlayers.size === 0) {
            this.players[1]([]);
            return;
        }

        const playingPlayers = Array.from(this.availablePlayers.entries())
            .filter(([_, player]) => player.playbackStatus[0].get() === PlaybackStatus.Playing)
            .sort(([a], [b]) => this._getPlayerPriority(a) - this._getPlayerPriority(b));

        if (playingPlayers.length > 0) {
            const [bestPlayingName, bestPlayingPlayer] = playingPlayers[0];
            this.players[1]([bestPlayingPlayer]);
            this.lastCurrentPlayerStatus = bestPlayingPlayer.playbackStatus[0].get();
            console.log("Selected playing player:", bestPlayingName);
            return;
        }

        const sortedPlayers = Array.from(this.availablePlayers.entries())
            .sort(([a], [b]) => this._getPlayerPriority(a) - this._getPlayerPriority(b));

        if (sortedPlayers.length > 0) {
            const [bestName, bestPlayer] = sortedPlayers[0];
            this.players[1]([bestPlayer]);
            this.lastCurrentPlayerStatus = bestPlayer.playbackStatus[0].get();
            console.log("Selected best priority player:", bestName);
        }
    }

    public destroy(): void {
        this._cancelPauseTimeout();
        if (this.statusCheckTimer) {
            this.statusCheckTimer.cancel();
        }
        for (const player of this.availablePlayers.values()) {
            player.destroy();
        }
    }
}

function formatTime(seconds: number): string {
    if (!seconds || seconds < 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function Mpris() {
    const mpris = MprisManager.get_default()

    return (
        <For each={mpris.players[0]}>
            {(player: Player) => (
                <box class="mpris" spacing={4}>
                                        <box
                        class="mpris-external-controls"
                        orientation={Gtk.Orientation.HORIZONTAL}
                        spacing={2}
                        halign={Gtk.Align.END}
                    >
                        <button
                            onClicked={() => player.previousTrack()}
                            visible={player.canGoPrevious[0]((can) => can)}
                            class="mpris-external-btn"
                        >
                            <label label={glyphs.mpris.previous} class="mpris-external-icon" />
                        </button>

                        <button
                            onClicked={() => player.playPause()}
                            visible={player.canControl[0]((can) => can)}
                            class="mpris-external-btn mpris-external-play"
                        >
                            <label
                                label={player.playbackStatus[0]((status) =>
                                    status === PlaybackStatus.Playing
                                        ? glyphs.mpris.pause
                                        : glyphs.mpris.play
                                )}
                                class="mpris-external-icon"
                            />
                        </button>

                        <button
                            onClicked={() => player.nextTrack()}
                            visible={player.canGoNext[0]((can) => can)}
                            class="mpris-external-btn"
                        >
                            <label label={glyphs.mpris.next} class="mpris-external-icon" />
                        </button>
                    </box>
                    <menubutton>
                        <label
                            label={player.displayText[0]((text) => text)}
                            class="mpris-title-label"
                            maxWidthChars={32}
                            ellipsize={3}
                            wrap={false}
                            halign={Gtk.Align.START}
                            heightRequest={16}
                            valign={Gtk.Align.CENTER}
                        />

                        <popover>
                            <box
                                class="mpris-popover"
                                orientation={Gtk.Orientation.HORIZONTAL}
                                spacing={6}
                            >
                                <box
                                    class="mpris-cover"
                                    widthRequest={120}
                                    heightRequest={120}
                                    css={player.localCoverPath[0]((path) =>
                                        path ? `background-image: url('file://${path}'); background-size: cover; background-position: center;` : ''
                                    )}
                                />

                                <box
                                    class="mpris-content"
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={8}
                                    vexpand
                                >
                                    <box
                                        class="mpris-info"
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        halign={Gtk.Align.START}
                                    >
                                        <label
                                            label={player.title[0]((title) => title)}
                                            class="mpris-info-title"
                                            maxWidthChars={26}
                                            ellipsize={3}
                                            wrap={false}
                                            halign={Gtk.Align.START}
                                        />
                                        <label
                                            label={player.artist[0]((artist) => artist)}
                                            class="mpris-info-artist"
                                            maxWidthChars={26}
                                            ellipsize={3}
                                            wrap={false}
                                            halign={Gtk.Align.START}
                                        />
                                    </box>

                                    <box
                                        class="mpris-progress"
                                        orientation={Gtk.Orientation.VERTICAL}
                                        spacing={2}
                                        vexpand
                                        valign={Gtk.Align.END}
                                    >
                                        <slider
                                            value={player.position[0]((pos) => pos)}
                                            min={0}
                                            max={player.trackLength[0]((len) => Math.max(len, 1))}
                                            drawValue={false}
                                            class="mpris-progress-slider"
                                            hexpand
                                        />
                                        <box
                                            class="mpris-progress-times"
                                            orientation={Gtk.Orientation.HORIZONTAL}
                                            spacing={0}
                                        >
                                            <label
                                                label={player.position[0]((pos) => formatTime(pos))}
                                                class="mpris-progress-time"
                                                halign={Gtk.Align.START}
                                                hexpand
                                            />
                                            <label
                                                label={player.trackLength[0]((len) => {
                                                    const remaining = len - player.position[0].get();
                                                    return `-${formatTime(remaining)}`;
                                                })}
                                                class="mpris-progress-time"
                                                halign={Gtk.Align.END}
                                            />
                                        </box>
                                    </box>

                                    <box
                                        class="mpris-controls"
                                        orientation={Gtk.Orientation.HORIZONTAL}
                                        spacing={4}
                                        halign={Gtk.Align.CENTER}
                                    >
                                        <button
                                            onClicked={() => player.previousTrack()}
                                            visible={player.canGoPrevious[0]((can) => can)}
                                            class="mpris-control-btn"
                                        >
                                            <label label={glyphs.mpris.previous} />
                                        </button>

                                        <button
                                            onClicked={() => player.seek(-10)}
                                            visible={player.canSeek[0]((can) => can)}
                                            class="mpris-control-btn mpris-control-seek"
                                        >
                                            <label label={glyphs.mpris.seekBackward} />
                                        </button>

                                        <button
                                            onClicked={() => player.playPause()}
                                            visible={player.canControl[0]((can) => can)}
                                            class="mpris-control-btn mpris-control-play"
                                        >
                                            <label
                                                label={player.playbackStatus[0]((status) =>
                                                    status === PlaybackStatus.Playing
                                                        ? glyphs.mpris.pause
                                                        : glyphs.mpris.play
                                                )}
                                            />
                                        </button>

                                        <button
                                            onClicked={() => player.seek(10)}
                                            visible={player.canSeek[0]((can) => can)}
                                            class="mpris-control-btn mpris-control-seek"
                                        >
                                            <label label={glyphs.mpris.seekForward} />
                                        </button>

                                        <button
                                            onClicked={() => player.nextTrack()}
                                            visible={player.canGoNext[0]((can) => can)}
                                            class="mpris-control-btn"
                                        >
                                            <label label={glyphs.mpris.next} />
                                        </button>
                                    </box>
                                </box>
                            </box>
                        </popover>

                    </menubutton>

                </box>
            )}
        </For>
    )
}
