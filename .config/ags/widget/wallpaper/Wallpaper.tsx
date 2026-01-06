import { Astal, Gtk, Gdk } from "ags/gtk4"
import { subprocess } from "ags/process"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
const WALLPAPER_DIR = `${GLib.get_home_dir()}/Pictures/wallpapers`
const PREVIEW_WIDTH = 240
const PREVIEW_HEIGHT = 320

export default function WallpaperCarousel() {
  let win: Astal.Window
  let wallpaperContainer: Gtk.Box
  let wallpapers: string[] = []
  let selectedWallpaperIndex = 0
  let wallpaperCards: Gtk.Box[] = [] // Cache des cartes créées
  
  function applyCss(cssText: string) {
    try {
      const cssProvider = new Gtk.CssProvider()
      cssProvider.load_from_string(cssText)
      
      const display = Gdk.Display.get_default()
      if (display) {
        Gtk.StyleContext.add_provider_for_display(
          display,
          cssProvider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )
      }
    } catch (error) {
      console.error("CSS Error:", error)
    }
  }

  async function applyCurrentWallpaper() {
    if (selectedWallpaperIndex < 0 || selectedWallpaperIndex >= wallpapers.length) return
    
    const wallpaperPath = wallpapers[selectedWallpaperIndex]
    const filename = wallpaperPath.split('/').pop()?.split('.')[0] || ''
    
    console.log(`Applying: ${filename}`)
    
    try {
      await subprocess(["swww", "img", wallpaperPath, "-a"])
      win.visible = false
    } catch (error) {
      console.error("Swww error:", error)
    }
  }

  // Créer UNE SEULE fois toutes les cartes
  function createAllWallpaperCards() {
    console.log(`Creating ${wallpapers.length} wallpaper cards once...`)
    wallpaperCards = []

    wallpapers.forEach((wallpaperPath, index) => {
      const filename = wallpaperPath.split('/').pop()?.split('.')[0] || ''
      
      const mainBox = new Gtk.Box()
      mainBox.set_orientation(Gtk.Orientation.VERTICAL)
      mainBox.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT)
      
      const overlay = new Gtk.Overlay()
      
      const backgroundBox = new Gtk.Box()
      backgroundBox.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT)
      backgroundBox.set_hexpand(true)
      backgroundBox.set_vexpand(true)
      
      const labelBox = new Gtk.Box()
      labelBox.set_valign(Gtk.Align.END)
      labelBox.set_halign(Gtk.Align.FILL)
      labelBox.add_css_class('wallpaper-label-container')
      
      const label = new Gtk.Label()
      label.set_text(filename)
      label.set_max_width_chars(16)
      label.set_ellipsize(3)
      label.add_css_class('wallpaper-label')
      
      labelBox.append(label)
      overlay.set_child(backgroundBox)
      overlay.add_overlay(labelBox)
      mainBox.append(overlay)

      // CSS unique pour chaque carte
      const cssClass = `wallpaper-${index}-${Date.now()}`
      backgroundBox.add_css_class(cssClass)
      
      const css = `
        .${cssClass} {
          background-image: url('file://${wallpaperPath}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          min-width: ${PREVIEW_WIDTH}px;
          min-height: ${PREVIEW_HEIGHT}px;
        }
      `
      
      applyCss(css)
      mainBox.add_css_class('wallpaper-card')
      
      // Stocker la carte dans le cache
      wallpaperCards[index] = mainBox
    })

    console.log(`All ${wallpaperCards.length} cards created and cached`)
  }

  // Fonction pour nettoyer les classes CSS d'une carte
  function clearCardStyles(card: Gtk.Box) {
    card.remove_css_class('carousel-center')
    card.remove_css_class('carousel-adjacent')
    card.remove_css_class('carousel-outer')
  }

  // Réorganiser les cartes existantes (RAPIDE !)
  function updateCarouselDisplay() {
    if (!wallpaperContainer || wallpapers.length === 0 || wallpaperCards.length === 0) return

    // Vider le container (mais garder les cartes en mémoire)
    let child = wallpaperContainer.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      wallpaperContainer.remove(child)
      child = next
    }
    
    // Réorganiser les 5 cartes visibles
    for (let position = 0; position < 5; position++) {
      const wallpaperIndex = selectedWallpaperIndex + position - 2
      
      if (wallpaperIndex >= 0 && wallpaperIndex < wallpapers.length) {
        const card = wallpaperCards[wallpaperIndex]
        
        // Nettoyer les anciennes classes
        clearCardStyles(card)
        
        // Appliquer le nouveau style selon la position
        if (position === 2) {
          card.add_css_class('carousel-center')
        } else if (position === 1 || position === 3) {
          card.add_css_class('carousel-adjacent')
        } else {
          card.add_css_class('carousel-outer')
        }
        
        wallpaperContainer.append(card)
      } else {
        // Espace vide
        const emptyBox = new Gtk.Box()
        emptyBox.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT)
        emptyBox.set_opacity(0)
        wallpaperContainer.append(emptyBox)
      }
    }
  }

  function moveLeft() {
    if (selectedWallpaperIndex > 0) {
      selectedWallpaperIndex--
      updateCarouselDisplay() // Juste réorganiser, pas recréer !
    }
  }

  function moveRight() {
    if (selectedWallpaperIndex < wallpapers.length - 1) {
      selectedWallpaperIndex++
      updateCarouselDisplay() // Juste réorganiser, pas recréer !
    }
  }

  function loadWallpapers() {
    wallpapers = []
    wallpaperCards = []
    
    try {
      const dir = Gio.File.new_for_path(WALLPAPER_DIR)
      if (!dir.query_exists(null)) {
        console.error("Wallpaper directory not found")
        return
      }

      const enumerator = dir.enumerate_children(
        'standard::name,standard::type',
        Gio.FileQueryInfoFlags.NONE,
        null
      )

      let fileInfo = enumerator.next_file(null)
      while (fileInfo !== null) {
        const name = fileInfo.get_name()
        const fileType = fileInfo.get_file_type()
        
        if (fileType === Gio.FileType.REGULAR && 
            name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          wallpapers.push(`${WALLPAPER_DIR}/${name}`)
        }
        fileInfo = enumerator.next_file(null)
      }
      enumerator.close(null)
      
      console.log(`Loaded ${wallpapers.length} wallpapers`)
      
      selectedWallpaperIndex = 0
      
      // Créer toutes les cartes UNE SEULE FOIS
      createAllWallpaperCards()
      
      // Puis juste les afficher
      updateCarouselDisplay()
      
    } catch (error) {
      console.error("Load error:", error)
    }
  }

  function onKey(_e: Gtk.EventControllerKey, keyval: number) {
    if (wallpapers.length === 0) return

    switch (keyval) {
      case Gdk.KEY_Escape:
        win.visible = false
        break
      case Gdk.KEY_Return:
        applyCurrentWallpaper()
        break
      case Gdk.KEY_Left:
        moveLeft()
        break
      case Gdk.KEY_Right:
        moveRight()
        break
    }
  }

  return (
    <window
      $={(ref) => (win = ref)}
      name="wallpaper-carousel"
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={({ visible }) => {
        if (visible) {
          selectedWallpaperIndex = 0
          loadWallpapers()
        }
      }}
    >
      <Gtk.EventControllerKey onKeyPressed={onKey} />
      
      <box
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        orientation={Gtk.Orientation.VERTICAL}
        spacing={30}
        cssClasses={["carousel-main"]}
      >
        <box
          $={(ref) => (wallpaperContainer = ref)}
          orientation={Gtk.Orientation.HORIZONTAL}
          spacing={40}
          halign={Gtk.Align.CENTER}
          cssClasses={["carousel-row"]}
        />

        <box orientation={Gtk.Orientation.HORIZONTAL} halign={Gtk.Align.CENTER} >
          <label label="← → Navigate  •  Enter Apply  •  Escape Close"  cssClasses={["instructions"]} />
        </box>
      </box>
    </window>
  )
}
