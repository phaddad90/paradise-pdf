// Prefer not to modify this file; logic lives in lib.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mac_batch_renamer_lib::run()
}
