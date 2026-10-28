import os

app = defines["app"]
app_name = os.path.basename(app)

format = "UDZO"
size = None
files = [app]
symlinks = {"Applications": "/Applications"}
badge_icon = None
icon = defines["volume_icon"]
background = defines["background"]

show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
sidebar_width = 0
window_rect = ((200, 120), (660, 420))
default_view = "icon-view"
include_icon_view_settings = "auto"
arrange_by = None
icon_size = 128
text_size = 13
icon_locations = {
    app_name: (180, 210),
    "Applications": (480, 210),
}
