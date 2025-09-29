import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import AstalNotifd from "gi://AstalNotifd"
import GLib from "gi://GLib?version=2.0"
import Notification from "./Notification"
import { createBinding, For, createState, onCleanup } from "ags"

export default function NotificationPopups() {
  const monitors = createBinding(app, "monitors")
  const notifd = AstalNotifd.get_default()

  const [notifications, setNotifications] = createState(
    new Array<AstalNotifd.Notification>(),
  )

  // Map pour garder trace des timers avec le bon type
  const notificationTimers = new Map<number, GLib.Source>()

  // Configuration des timeouts (en millisecondes)
  const TIMEOUT_NORMAL = 5000    // 5 secondes
  const TIMEOUT_CRITICAL = 10000 // 10 secondes
  const TIMEOUT_LOW = 3000       // 3 secondes

  function getTimeoutForNotification(notification: AstalNotifd.Notification): number {
    switch (notification.urgency) {
      case AstalNotifd.Urgency.CRITICAL:
        return TIMEOUT_CRITICAL
      case AstalNotifd.Urgency.LOW:
        return TIMEOUT_LOW
      case AstalNotifd.Urgency.NORMAL:
      default:
        return TIMEOUT_NORMAL
    }
  }

  function removeNotification(id: number) {
    setNotifications((ns) => ns.filter((n) => n.id !== id))
    
    // Nettoyer le timer GLib.Source
    const source = notificationTimers.get(id)
    if (source) {
      source.destroy()
      notificationTimers.delete(id)
    }
  }

  function startAutoTimeout(notification: AstalNotifd.Notification) {
    // Annuler le timer existant
    const existingSource = notificationTimers.get(notification.id)
    if (existingSource) {
      existingSource.destroy()
    }

    const timeoutMs = getTimeoutForNotification(notification)
    
    // Utiliser setTimeout qui retourne GLib.Source dans GJS
    const source = setTimeout(() => {
      removeNotification(notification.id)
      
      // Dismiss côté daemon aussi
      try {
        notification.dismiss()
      } catch (e) {
        // Ignore si déjà dismissed
      }
    }, timeoutMs)

    notificationTimers.set(notification.id, source)
  }

  const notifiedHandler = notifd.connect("notified", (_, id, replaced) => {
    const notification = notifd.get_notification(id)

    if (replaced && notifications.get().some((n) => n.id === id)) {
      // Notification remplacée
      setNotifications((ns) => ns.map((n) => (n.id === id ? notification : n)))
      startAutoTimeout(notification)
    } else {
      // Nouvelle notification
      setNotifications((ns) => [notification, ...ns])
      startAutoTimeout(notification)
    }
  })

  const resolvedHandler = notifd.connect("resolved", (_, id) => {
    removeNotification(id)
  })

  onCleanup(() => {
    notifd.disconnect(notifiedHandler)
    notifd.disconnect(resolvedHandler)
    
    // Nettoyer tous les timers GLib.Source
    for (const source of notificationTimers.values()) {
      source.destroy()
    }
    notificationTimers.clear()
  })

  return (
    <For each={monitors}>
      {(monitor) => (
        <window
          $={(self) => onCleanup(() => self.destroy())}
          class="NotificationPopups"
          gdkmonitor={monitor}
          visible={notifications((ns) => ns.length > 0)}
          anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
          exclusivity={Astal.Exclusivity.IGNORE}
          keymode={Astal.Keymode.NONE}
          application={app}
        >
          <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <For each={notifications}>
              {(notification) => (
                <Notification 
                  notification={notification}
                  onDismiss={() => removeNotification(notification.id)}
                />
              )}
            </For>
          </box>
        </window>
      )}
    </For>
  )
}
