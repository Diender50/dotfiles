from ignis import widgets
from ignis import utils
from .widgets import Workspaces, Clock, Tray


class Bar(widgets.Window):
    __gtype_name__ = "Bar"

    def __init__(self, monitor: int):
        monitor_name = utils.get_monitor(monitor).get_connector(),
        super().__init__(
            anchor=["left", "top", "right"],
            exclusivity="exclusive",
            monitor=monitor,
            namespace=f"ignis_BAR_{monitor}",
            layer="top",
            kb_mode="none",
            child=widgets.CenterBox(
                css_classes=["bar"],
                start_widget=widgets.Box(child=[Workspaces(monitor_name)]),
                center_widget=widgets.Box(child=[Clock()]),
                end_widget=widgets.Box(child=[Tray()])
            ),
            css_classes=["unset"],
        )