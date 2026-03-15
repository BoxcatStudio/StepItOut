use std::fs;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("Image files", &["png", "exr", "jpg", "jpeg"])
        .blocking_pick_file();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn open_files_dialog(app: AppHandle) -> Result<Vec<String>, String> {
    let paths = app
        .dialog()
        .file()
        .add_filter("Image files", &["png", "exr", "jpg", "jpeg", "PNG", "EXR", "JPG", "JPEG"])
        .blocking_pick_files();
    Ok(paths
        .map(|p| p.into_iter().map(|x| x.to_string()).collect())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn read_folder_light_passes(folder_path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let entries = fs::read_dir(&folder_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext = ext.to_string_lossy();
                if ext.eq_ignore_ascii_case("png") || 
                   ext.eq_ignore_ascii_case("exr") ||
                   ext.eq_ignore_ascii_case("jpg") ||
                   ext.eq_ignore_ascii_case("jpeg") {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    files.sort();
    Ok(files)
}

#[tauri::command]
pub async fn open_stepseq_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .add_filter("STEP Projects", &["step", "stepseq"])
        .blocking_pick_file();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn open_directory_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let path = app.dialog().file().blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    default_name: Option<String>,
    filter_name: Option<String>,
    filter_ext: Option<Vec<String>>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();

    match (filter_name, filter_ext) {
        (Some(name), Some(ext)) => {
            let ext_strs: Vec<&str> = ext.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(name, &ext_strs);
        }
        _ => {
            dialog = dialog.add_filter("STEP Projects", &["step", "stepseq"]);
        }
    }

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    Ok(dialog.blocking_save_file().map(|p| p.to_string()))
}