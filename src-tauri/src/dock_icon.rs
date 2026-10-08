//! The Dock icon the learner chose in Settings > Eva. The app bundle's own icon (Finder, Launchpad)
//! is the dark one and cannot change at runtime; this swaps only the running app's Dock tile.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DockIcon {
    Dark,
    Light,
}

/// `icons/source/eva-icon-light.svg` at 512 px.
const LIGHT_ICON_PNG: &[u8] = include_bytes!("../icons/dock-light.png");

/// Shows `icon` in the Dock. A no-op outside macOS.
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
    match icon {
        // `None` restores the icon from the app bundle.
        DockIcon::Dark => unsafe { application.setApplicationIconImage(None) },
        DockIcon::Light => {
            let data = NSData::with_bytes(LIGHT_ICON_PNG);
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
        assert_eq!(serde_json::to_string(&DockIcon::Dark).unwrap(), "\"dark\"");
        assert_eq!(
            serde_json::from_str::<DockIcon>("\"light\"").unwrap(),
            DockIcon::Light
        );
        assert!(serde_json::from_str::<DockIcon>("\"rabbit\"").is_err());
    }

    #[test]
    fn the_light_icon_is_a_square_png() {
        assert_eq!(&LIGHT_ICON_PNG[..8], b"\x89PNG\r\n\x1a\n");
        let dimension = |at: usize| {
            u32::from_be_bytes([
                LIGHT_ICON_PNG[at],
                LIGHT_ICON_PNG[at + 1],
                LIGHT_ICON_PNG[at + 2],
                LIGHT_ICON_PNG[at + 3],
            ])
        };
        assert_eq!((dimension(16), dimension(20)), (512, 512));
    }
}
