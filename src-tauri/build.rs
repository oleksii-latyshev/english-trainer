use std::{env, path::PathBuf, process::Command};

fn main() {
    // Only the Swift source is an input. The compiled helper in binaries/ is this script's output;
    // listing it too made every build rewrite it and rerun the script, and `tauri dev` restarted
    // on each rewrite in an endless loop. A deleted helper comes back with `cargo clean`.
    println!("cargo:rerun-if-changed=apple/ConversationModel.swift");
    println!("cargo:rerun-if-changed=apple/WordTranslation.swift");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let target = env::var("TARGET").expect("Cargo provides target");
        let architecture = target.split('-').next().expect("target architecture");
        let architecture = if architecture == "aarch64" {
            "arm64"
        } else {
            architecture
        };
        compile_helper(
            architecture,
            "apple/ConversationModel.swift",
            "apple-conversation",
            false,
        );
        compile_helper(
            architecture,
            "apple/WordTranslation.swift",
            "apple-translation",
            true,
        );
    }
    println!("cargo:rerun-if-changed=voice/Speech.cpp");
    println!("cargo:rerun-if-changed=voice/licenses");
    println!("cargo:rerun-if-changed=../scripts/prepare-voice.sh");
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos")
        && env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("aarch64")
    {
        let status = Command::new("sh")
            .arg("../scripts/prepare-voice.sh")
            .status()
            .expect("Could not prepare bundled local voice");
        assert!(status.success(), "Could not prepare bundled local voice");
    }
    tauri_build::build()
}

fn compile_helper(architecture: &str, source: &str, binary: &str, is_library: bool) {
    let output = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("binaries")
        .join(binary);
    std::fs::create_dir_all(output.parent().unwrap()).unwrap();
    let cache = PathBuf::from(env::var("OUT_DIR").unwrap()).join("swift-cache");
    let mut compiler = Command::new("xcrun");
    compiler.args([
        "swiftc",
        "-O",
        "-target",
        &format!("{architecture}-apple-macosx14.0"),
    ]);
    if is_library {
        compiler.arg("-parse-as-library");
    }
    let status = compiler
        .arg(source)
        .arg("-o")
        .arg(&output)
        .arg("-module-cache-path")
        .arg(cache)
        .status()
        .expect("Swift compiler is required for bundled Apple helpers");
    assert!(status.success(), "Could not compile {binary}");
    let status = Command::new("codesign")
        .args(["--force", "--sign", "-"])
        .arg(&output)
        .status()
        .expect("codesign is required for bundled Apple helpers");
    assert!(status.success(), "Could not sign {binary}");
}
