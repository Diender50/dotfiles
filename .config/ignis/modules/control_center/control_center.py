from ignis import widgets, utils
from ignis.window_manager import WindowManager

wm = WindowManager.get_default()

class ControlCenter(widgets.RevealerWindow):
    def __init__(self):
        calendar = widgets.Label(label="test")

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
            transition_type="slide_right",
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
            anchor=["top","right"],
            layer="top",
            namespace="ignis-ControlCenter",
            css_classes=["control_center"]
        )