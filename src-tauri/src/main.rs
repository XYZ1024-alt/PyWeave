#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pyweave_tauri_lib::run();
}
