use std::{env, path::PathBuf, process::Command};

fn main() {
    // Only the Swift source is an input. The compiled helper in binaries/ is this script's output;
    // listing it too made every build rewrite it and rerun the script, and `tauri dev` restarted
    // on each rewrite in an endless loop. A deleted helper comes back with `cargo clean`.
    println!("cargo:rerun-if-changed=apple/ConversationModel.swift");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let target = env::var("TARGET").expect("Cargo provides target");
        let architecture = target.split('-').next().expect("target architecture");
        let architecture = if architecture == "aarch64" {
            "arm64"
        } else {
            architecture
        };
        let output = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
            .join("binaries/apple-conversation");
        std::fs::create_dir_all(output.parent().unwrap()).unwrap();
        let cache = PathBuf::from(env::var("OUT_DIR").unwrap()).join("swift-cache");
        let status = Command::new("xcrun")
            .args([
                "swiftc",
                "-O",
                "-target",
                &format!("{architecture}-apple-macosx14.0"),
                "apple/ConversationModel.swift",
                "-o",
            ])
            .arg(&output)
            .arg("-module-cache-path")
            .arg(cache)
            .status()
            .expect("Swift compiler is required for the bundled Apple helper");
        assert!(
            status.success(),
            "Could not compile the Apple conversation helper"
        );
        let status = Command::new("codesign")
            .args(["--force", "--sign", "-"])
            .arg(&output)
            .status()
            .expect("codesign is required for the Apple helper");
        assert!(
            status.success(),
            "Could not sign the Apple conversation helper"
        );
    }
    tauri_build::build()
}
