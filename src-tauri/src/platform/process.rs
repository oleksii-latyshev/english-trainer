use std::process::Command;

pub fn command_line_of(pid: u32) -> Option<String> {
    let output = list_command(pid).output().ok()?;
    Some(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn terminate(pid: u32) -> std::io::Result<()> {
    kill_command(pid).status().map(|_| ())
}

#[cfg(unix)]
fn list_command(pid: u32) -> Command {
    let mut command = Command::new("ps");
    command.args(["-p", &pid.to_string(), "-o", "command="]);
    command
}

#[cfg(unix)]
fn kill_command(pid: u32) -> Command {
    let mut command = Command::new("kill");
    command.arg(pid.to_string());
    command
}

#[cfg(windows)]
fn list_command(pid: u32) -> Command {
    let mut command = hidden(Command::new("tasklist"));
    command.args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"]);
    command
}

#[cfg(windows)]
fn kill_command(pid: u32) -> Command {
    let mut command = hidden(Command::new("taskkill"));
    command.args(["/PID", &pid.to_string(), "/F"]);
    command
}

#[cfg(windows)]
fn hidden(mut command: Command) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    fn long_running() -> Command {
        let mut command = Command::new("sleep");
        command.arg("30");
        command
    }

    #[cfg(windows)]
    fn long_running() -> Command {
        let mut command = Command::new("ping");
        command.args(["-n", "30", "127.0.0.1"]);
        command
    }

    #[test]
    fn the_command_line_of_a_running_process_is_readable() {
        assert!(command_line_of(std::process::id()).is_some_and(|line| !line.trim().is_empty()));
    }

    #[test]
    fn a_running_process_can_be_terminated() {
        let mut child = long_running().spawn().unwrap();
        terminate(child.id()).unwrap();
        let status = child.wait().unwrap();
        assert!(!status.success());
    }
}
