import { Gtk } from "ags/gtk4"
import Gdk from "gi://Gdk?version=4.0"
import GLib from "gi://GLib"
import AstalNotifd from "gi://AstalNotifd"
import Pango from "gi://Pango"

function isIcon(icon?: string | null) {
  if (!icon) return false
  try {
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!)
    return iconTheme.has_icon(icon)
  } catch {
    return false
  }
}

function fileExists(path: string) {
  if (!path) return false
  try {
    return GLib.file_test(path, GLib.FileTest.EXISTS)
  } catch {
    return false
  }
}

function formatTime(time: number, format = "%H:%M") {
  try {
    return GLib.DateTime.new_from_unix_local(time).format(format) || ""
  } catch {
    return ""
  }
}

function getUrgencyClass(n: AstalNotifd.Notification) {
  const { LOW, NORMAL, CRITICAL } = AstalNotifd.Urgency
  switch (n.urgency) {
    case LOW:
      return "low"
    case CRITICAL:
      return "critical"
    case NORMAL:
    default:
      return "normal"
  }
}

interface NotificationProps {
  notification: AstalNotifd.Notification
  onDismiss?: () => void
}

export default function Notification({ notification: n, onDismiss }: NotificationProps) {
  const handleDismiss = () => {
    try {
      n.dismiss()
    } catch (e) {
      // Ignore si déjà dismissed
    }
    onDismiss?.()
  }

  const handleAction = (actionId: string) => {
    try {
      n.invoke(actionId)
    } catch (e) {
      console.error("Failed to invoke action:", e)
    }
    onDismiss?.()
  }

  return (
    <box
      class={`Notification ${getUrgencyClass(n)}`}
      orientation={Gtk.Orientation.VERTICAL}
      widthRequest={350}
    >
      {/* Header */}
      <box class="header" spacing={8}>
        {(n.appIcon && isIcon(n.appIcon)) && (
          <image
            class="app-icon"
            iconName={n.appIcon}
            pixelSize={16}
          />
        )}
        
        {(n.desktopEntry && !n.appIcon && isIcon(n.desktopEntry)) && (
          <image
            class="app-icon"
            iconName={n.desktopEntry}
            pixelSize={16}
          />
        )}
        
        <label
          class="app-name"
          halign={Gtk.Align.START}
          ellipsize={Pango.EllipsizeMode.END}
          label={n.appName || "Unknown"}
        />
        
        <label
          class="time"
          hexpand
          halign={Gtk.Align.END}
          label={formatTime(n.time)}
        />
        
        <button onClicked={handleDismiss} class="close-button">
          <image iconName="window-close-symbolic" pixelSize={12} />
        </button>
      </box>

      {/* Separator */}
      <Gtk.Separator visible />

      {/* Content */}
      <box class="content" spacing={8}>
        {/* Image */}
        {n.image && fileExists(n.image) && (
          <image 
            valign={Gtk.Align.START}
            class="image" 
            file={n.image}
            pixelSize={64}
          />
        )}
        
        {n.image && !fileExists(n.image) && isIcon(n.image) && (
          <box valign={Gtk.Align.START} class="icon-image">
            <image
              iconName={n.image}
              pixelSize={64}
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.CENTER}
            />
          </box>
        )}

        {/* Text content */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
          <label
            class="summary"
            halign={Gtk.Align.START}
            xalign={0}
            label={n.summary || ""}
            ellipsize={Pango.EllipsizeMode.END}
            wrap
          />
          
          {n.body && (
            <label
              class="body"
              wrap
              useMarkup
              halign={Gtk.Align.START}
              xalign={0}
              justify={Gtk.Justification.FILL}
              label={n.body}
            />
          )}
        </box>
      </box>

      {/* Actions */}
      {n.actions.length > 0 && (
        <box class="actions" spacing={8}>
          {n.actions.map(({ label, id }) => (
            <button 
              hexpand 
              onClicked={() => handleAction(id)}
              class="action-button"
            >
              <label 
                label={label || ""} 
                halign={Gtk.Align.CENTER} 
                hexpand 
              />
            </button>
          ))}
        </box>
      )}
    </box>
  )
}
