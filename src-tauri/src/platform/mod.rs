mod process;
mod tools;

pub use process::{command_line_of, terminate};
pub use tools::{
    find_tool, home_dir, system_install_dirs, user_install_dirs, WHISPER_SERVER_INSTALL_HINT,
};
