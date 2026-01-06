import { For, createState } from "ags"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import AstalApps from "gi://AstalApps"
import Graphene from "gi://Graphene"
import { execAsync } from "ags/process"
import { readFile } from "ags/file"

const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

export default function Applauncher() {
  let contentbox: Gtk.Box
  let searchentry: Gtk.Entry
  let win: Astal.Window

  const apps = new AstalApps.Apps()
  const [list, setList] = createState(new Array<AstalApps.Application>())

  function search(text: string) {
  apps.reload() // Ajoute ceci pour recharger les applications
  if (text === "") setList([])
  else setList(apps.fuzzy_query(text).slice(0, 8))
}


  function getExecCommand(app: AstalApps.Application): string {
    const appAny = app as any
    
    // Essayer d'abord d'extraire l'Exec du fichier .desktop
    if (appAny.desktop) {
      try {
        const desktopContent = readFile(appAny.desktop)
        const execMatch = desktopContent.match(/^Exec=(.+)$/m)
        if (execMatch) {
          return execMatch[1]
        }
      } catch (error) {
        console.warn(`Impossible de lire ${appAny.desktop}:`, error)
      }
    }
    
    // Fallback sur executable ou name
    return appAny.executable || appAny.name || app.name
  }

  function cleanCommand(command: string): string {
    // Supprimer les codes de champ selon la spécification FreeDesktop
    // %f - single file
    // %F - multiple files  
    // %u - single URL
    // %U - multiple URLs
    // %d, %n, %N, %v, %m - codes obsolètes
    command = command.replace(/\s+%[fuFUdnNvm]\b/g, '')
    
    // Supprimer les options courantes qui peuvent poser problème
    command = command.replace(/\s+--new-window/g, '')
    command = command.replace(/\s+--new-tab/g, '')
    
    // Nettoyer les espaces multiples et trimmer
    return command.replace(/\s+/g, ' ').trim()
  }

  function launch(app?: AstalApps.Application) {
    if (!app) return
    
    win.hide()
    
    try {
      let command = getExecCommand(app)
      command = cleanCommand(command)
      
      console.log(`Lancement de ${app.name} avec la commande: ${command}`)
      
      // Méthode principale : détachement complet avec nohup + setsid + disown
      execAsync([
        "sh", 
        "-c", 
        `nohup setsid ${command} </dev/null >/dev/null 2>&1 & disown`
      ]).catch((error) => {
        console.error(`Erreur avec nohup pour ${app.name}:`, error)
        
        // Fallback 1: Double fork pattern
        execAsync([
          "sh",
          "-c", 
          `(${command} &) && exit`
        ]).catch((fallbackError) => {
          console.error(`Erreur double fork pour ${app.name}:`, fallbackError)
          
          // Fallback 2: Méthode native AstalApps
          try {
            app.launch()
          } catch (nativeError) {
            console.error(`Erreur méthode native pour ${app.name}:`, nativeError)
            
            // Fallback 3: Simple background execution
            execAsync(command.split(' ')).catch((simpleError) => {
              console.error(`Tous les fallbacks ont échoué pour ${app.name}:`, simpleError)
            })
          }
        })
      })
      
    } catch (error) {
      console.error(`Erreur générale lors du lancement de ${app.name}:`, error)
    }
  }

  // Gestion des touches
  function onKey(
    _e: Gtk.EventControllerKey,
    keyval: number,
    _: number,
    mod: number,
  ) {
    // Fermer sur ESC
    if (keyval === Gdk.KEY_Escape) {
      win.visible = false
      return
    }

    // Lancer avec Alt + numéro
    if (mod === Gdk.ModifierType.ALT_MASK) {
      for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
        if (keyval === Gdk[`KEY_${i}`]) {
          const appToLaunch = list.get()[i - 1]
          if (appToLaunch) {
            launch(appToLaunch)
          }
          return
        }
      }
    }

    // Lancer avec Entrée sur le premier résultat
    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      const firstApp = list.get()[0]
      if (firstApp) {
        launch(firstApp)
      }
    }
  }

  // Fermer en cliquant à l'extérieur
  function onClick(_e: Gtk.GestureClick, _: number, x: number, y: number) {
    const [, rect] = contentbox.compute_bounds(win)
    const position = new Graphene.Point({ x, y })

    if (!rect.contains_point(position)) {
      win.visible = false
      return true
    }
    
    return false
  }

  return (
    <window
      $={(ref) => (win = ref)}
      name="launcher"
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      onNotifyVisible={({ visible }) => {
        if (visible) {
          searchentry.grab_focus()
        } else {
          searchentry.set_text("")
          setList([]) // Nettoyer la liste quand on ferme
        }
      }}
    >
      <Gtk.EventControllerKey onKeyPressed={onKey} />
      <Gtk.GestureClick onPressed={onClick} />
      
      <box
        $={(ref) => (contentbox = ref)}
        name="launcher-content"
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        <entry
          $={(ref) => (searchentry = ref)}
          onNotifyText={({ text }) => search(text)}
          placeholderText="Tapez pour rechercher..."
          name="search-entry"
        />
        
        <box 
          orientation={Gtk.Orientation.VERTICAL} 
          name="results-box"
          spacing={4}
        >
          <For each={list}>
            {(app, index) => (
              <button 
                onClicked={() => launch(app)}
                name="app-button"
                hexpand={true}
              >
                <box spacing={12} hexpand={true}>
                  <image 
                    iconName={app.iconName} 
                    pixelSize={32}
                    name="app-icon"
                  />
                  <box 
                    orientation={Gtk.Orientation.VERTICAL} 
                    halign={Gtk.Align.START}
                    hexpand={true}
                  >
                    <label 
                      label={app.name} 
                      maxWidthChars={40}
                      ellipsize={3} // PANGO_ELLIPSIZE_END
                      halign={Gtk.Align.START}
                      name="app-name"
                    />
                    <label 
                      label={app.description || ""}
                      maxWidthChars={50}
                      ellipsize={3}
                      halign={Gtk.Align.START}
                      name="app-description"
                    />
                  </box>
                  <label
                    halign={Gtk.Align.END}
                    label={index((i) => `󰘳 ${i + 1}`)}
                    name="app-shortcut"
                  />
                </box>
              </button>
            )}
          </For>
        </box>
      </box>
    </window>
  )
}
