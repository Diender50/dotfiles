from ignis import widgets
from ignis.services.niri import NiriService, NiriWorkspace

niri = NiriService.get_default()

class WorkspaceButton(widgets.Button):
    def __init__(self, workspace: NiriWorkspace) -> None:
        super().__init__(
            css_classes=["workspace", "unset"],
            on_click=lambda x: workspace.switch_to(),
            halign="start",
            valign="center",
            child=widgets.Label(label=str(workspace.idx)),
        )
        if workspace.is_active:
            self.add_css_class("active")

def scroll_workspaces(monitor_name: str, direction: str) -> None:
    current = list(
        filter(lambda w: w.is_active and w.output == monitor_name[0], niri.workspaces)
    )[0].idx
    if direction == "up":
        target = current + 1
        niri.switch_to_workspace(target)
    else:
        target = current - 1
        niri.switch_to_workspace(target)

class Workspaces(widgets.Box):
    def __init__(self, monitor_name: str):
        if niri.is_available:
            child = [
                widgets.EventBox(
                    on_scroll_up=lambda x: scroll_workspaces(monitor_name, "up"),
                    on_scroll_down=lambda x: scroll_workspaces(monitor_name, "down"),
                    css_classes=["workspaces"],
                    child=niri.bind(
                        "workspaces",
                        transform=lambda workspaces: [
                            WorkspaceButton(w) for w in workspaces if w.output == monitor_name[0]
                        ],
                    ),
                )
            ]
        else:
            child = []
        super().__init__(child=child)

