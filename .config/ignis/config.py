import os
from ignis.services.audio import AudioService
from ignis import utils
from modules import (
    Bar,
    ControlCenter,
)
from ignis.css_manager import CssManager, CssInfoString, CssInfoPath


css_manager = CssManager.get_default()

css_manager.apply_css(
    CssInfoPath(
        name="main",
        compiler_function=lambda path: utils.sass_compile(path=path),
        path=os.path.join(utils.get_current_dir(), "style.scss"),
    )
)
ControlCenter()
for monitor in range(utils.get_n_monitors()):
    Bar(monitor)