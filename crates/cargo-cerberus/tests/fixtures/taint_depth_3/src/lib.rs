// Tainted input flow to sink
#[tauri::command]
pub fn export_doc(path: String) {
    step_one(path);
}

fn step_one(p: String) {
    step_two(p);
}

fn step_two(p: String) {
    execute_shell(p);
}

fn execute_shell(cmd: String) {
    std::process::Command::new("cmd.exe")
        .arg("/C")
        .arg(cmd)
        .status()
        .unwrap();
}
