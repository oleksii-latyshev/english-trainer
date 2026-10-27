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

const EVA_STAGE_PNGS: [&[u8]; 6] = [
    include_bytes!("../icons/dock-eva-0.png"),
    include_bytes!("../icons/dock-eva-1.png"),
    include_bytes!("../icons/dock-eva-2.png"),
    include_bytes!("../icons/dock-eva-3.png"),
    include_bytes!("../icons/dock-eva-4.png"),
    include_bytes!("../icons/dock-eva-5.png"),
];

impl DockIcon {
    fn png(self, stage: Option<u8>) -> Option<&'static [u8]> {
        match self {
            DockIcon::Eva => stage
                .and_then(|stage| EVA_STAGE_PNGS.get(usize::from(stage)))
                .copied(),
            DockIcon::Dark => Some(DARK_ICON_PNG),
            DockIcon::Light => Some(LIGHT_ICON_PNG),
        }
    }
}

#[cfg(target_os = "macos")]
pub fn apply(app: &tauri::AppHandle, icon: DockIcon, stage: Option<u8>) -> Result<(), String> {
    app.run_on_main_thread(move || set_application_icon(icon, stage))
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn apply(_app: &tauri::AppHandle, _icon: DockIcon, _stage: Option<u8>) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_application_icon(icon: DockIcon, stage: Option<u8>) {
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::{MainThreadMarker, NSData};

    let Some(main_thread) = MainThreadMarker::new() else {
        return;
    };
    let application = NSApplication::sharedApplication(main_thread);
    match icon.png(stage) {
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
    fn eva_without_a_stage_restores_the_bundle_icon_and_the_others_ship_a_png() {
        assert!(DockIcon::Eva.png(None).is_none());
        assert!(DockIcon::Dark.png(None).is_some());
        assert!(DockIcon::Light.png(None).is_some());
    }

    #[test]
    fn eva_picks_the_tile_of_her_stage() {
        for stage in 0..6u8 {
            assert_eq!(
                DockIcon::Eva.png(Some(stage)),
                Some(EVA_STAGE_PNGS[usize::from(stage)])
            );
        }
        assert!(DockIcon::Eva.png(Some(6)).is_none());
    }

    #[test]
    fn dark_and_light_ignore_the_stage() {
        assert_eq!(DockIcon::Dark.png(Some(3)), Some(DARK_ICON_PNG));
        assert_eq!(DockIcon::Light.png(Some(3)), Some(LIGHT_ICON_PNG));
    }

    #[test]
    fn every_dock_icon_is_a_square_png() {
        for png in EVA_STAGE_PNGS
            .into_iter()
            .chain([DARK_ICON_PNG, LIGHT_ICON_PNG])
        {
            assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
            let dimension =
                |at: usize| u32::from_be_bytes([png[at], png[at + 1], png[at + 2], png[at + 3]]);
            assert_eq!((dimension(16), dimension(20)), (512, 512));
        }
    }
}
