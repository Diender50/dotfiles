import { createBinding, For, This } from "ags"
import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/bar/Bar"
import Applauncher from "./widget/applauncher/Applauncher"
import NotificationPopups from "./widget/notifications/NotificationPopups"
import WallpaperCarousel from "./widget/wallpaper/Wallpaper" // ← Ajouter l'import

import Gtk from "gi://Gtk?version=4.0"

let applauncher: Gtk.Window
let wallpaperCarousel: Gtk.Window // ← Déclarer la variable

app.start({
  css: style,
  gtkTheme: "Colloid-Light",
  icons: `${SRC}/assets/icons`,
  
  requestHandler(request, res) {
    // request est déjà un string[], pas besoin de parser
    if (!request || request.length === 0) return res("no arguments")

    switch (request[0]) { // ← Utiliser request[0] directement
      case "applauncher":
        if (applauncher) {
          applauncher.visible = !applauncher.visible
        }
        return res("ok")
      
      case "wallpaper": // ← Ajouter le case wallpaper
        if (wallpaperCarousel) {
          wallpaperCarousel.visible = !wallpaperCarousel.visible
        }
        return res("ok")
        
      default:
        return res("unknown command")
    }
  },
  
  main() {
    NotificationPopups()
    applauncher = Applauncher() as Gtk.Window
    wallpaperCarousel = WallpaperCarousel() as Gtk.Window // ← Initialiser le carrousel
    
    app.add_window(applauncher)
    app.add_window(wallpaperCarousel) // ← Ajouter à l'application
    
    const monitors = createBinding(app, "monitors")

    return (
      <For each={monitors}>
        {(monitor) => (
          <This this={app}>
            <Bar gdkmonitor={monitor} />
          </This>
        )}
      </For>
    )
  },
})
