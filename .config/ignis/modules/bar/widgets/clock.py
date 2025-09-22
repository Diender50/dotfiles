import datetime
from ignis import widgets, utils
from ignis.window_manager import WindowManager

wm = WindowManager.get_default()

class Calendar(widgets.RevealerWindow):
    def __init__(self):
        calendar = widgets.Calendar()

        close_button = widgets.Button(
            label="Fermer",
            css_classes=["close"],
            hexpand=False,
            vexpand=False,
            halign="center",
            valign="center",
        )

        close_button.connect("clicked", lambda _: self.set_visible(False))

        content_box = widgets.Box(
            orientation="vertical",
            child=[calendar, close_button]
        )

        revealer = widgets.Revealer(
            transition_type="slide_up",
            child=content_box,
            transition_duration=300,
            reveal_child=True,
        )
        box = widgets.Box(child=[revealer])
        super().__init__(
            revealer=revealer,
            child=box,
            visible=False,
            kb_mode="exclusive",
            popup=True,
            anchor=["top"],
            layer="top",
            namespace="ignis-Calendrier",
            css_classes=["calendar"]
        )

class Clock(widgets.Button):
    def __init__(self):
        super().__init__()
        self.popup = None
        try:
            self.popup = wm.get_window("ignis-Calendrier")
        except Exception:
            pass
        if self.popup is None:
            self.popup = Calendar()

        self.connect("clicked", self.on_clicked)

        # Démarrage du poll qui met à jour le label chaque seconde
        self._poll = utils.Poll(1000, lambda _: self._update_label())
        self._update_label()  # Mise à jour immédiate

    def _update_label(self):
        text = datetime.datetime.now().strftime("%A %d %B - %Hh%M")
        self.set_label(text)

    def on_clicked(self, *_):
        visible = self.popup.get_visible()
        self.popup.set_visible(not visible)
