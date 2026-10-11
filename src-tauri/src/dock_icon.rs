use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DockIcon {
    Eva,
    Dark,
    Light,
}

const DARK_ICON_PNG: &[u8] = include_bytes!("../icons/dock-dark.png");
const LIGHT_ICON_PNG: &[u8] = include_bytes!("../icons/dock-light.png");

impl DockIcon {
    fn png(self) -> Option<&'static [u8]> {
        match self {
            DockIcon::Eva => None,
            DockIcon::Dark => Some(DARK_ICON_PNG),
            DockIcon::Light => Some(LIGHT_ICON_PNG),
        }
    }
}

#[cfg(target_os = "macos")]
pub fn apply(app: &tauri::AppHandle, icon: DockIcon) -> Result<(), String> {
    app.run_on_main_thread(move || set_application_icon(icon))
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn apply(_app: &tauri::AppHandle, _icon: DockIcon) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_application_icon(icon: DockIcon) {
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{MainThreadMarker, NSData};

    let Some(main_thread) = MainThreadMarker::new() else {
        return;
    };
    let application = NSApplication::sharedApplication(main_thread);
    match icon.png() {
        None => unsafe { application.setApplicationIconImage(None) },
        Some(png) => {
            let data = NSData::with_bytes(png);
            let image = NSImage::initWithData(NSImage::alloc(), &data);
            unsafe { application.setApplicationIconImage(image.as_deref()) }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_choice_crosses_ipc_as_a_lowercase_word() {
        assert_eq!(serde_json::to_string(&DockIcon::Eva).unwrap(), "\"eva\"");
        assert_eq!(serde_json::to_string(&DockIcon::Dark).unwrap(), "\"dark\"");
        assert_eq!(
            serde_json::from_str::<DockIcon>("\"light\"").unwrap(),
            DockIcon::Light
        );
        assert!(serde_json::from_str::<DockIcon>("\"rabbit\"").is_err());
    }

    #[test]
    fn the_bundle_icon_is_restored_by_eva_and_the_others_ship_a_png() {
        assert!(DockIcon::Eva.png().is_none());
        assert!(DockIcon::Dark.png().is_some());
        assert!(DockIcon::Light.png().is_some());
    }

    #[test]
    fn every_dock_icon_is_a_square_png() {
        for png in [DARK_ICON_PNG, LIGHT_ICON_PNG] {
            assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
            let dimension =
                |at: usize| u32::from_be_bytes([png[at], png[at + 1], png[at + 2], png[at + 3]]);
            assert_eq!((dimension(16), dimension(20)), (512, 512));
        }
    }
}
