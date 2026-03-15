use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepSeqLight {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub division: String,
    pub pattern: Vec<u8>,
    pub attack: u32,
    pub decay: u32,
    pub intensity: f64,
    pub curve: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepSeqLayerBank {
    pub pattern: Vec<u8>,
    pub division: serde_json::Value,
    pub attack: Option<u32>,
    pub decay: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepSeqPatternBank {
    pub duration_seconds: u32,
    pub layers: std::collections::HashMap<String, StepSeqLayerBank>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepSeqFile {
    pub fps: u32,
    pub loop_seconds: u32,
    pub lights: Vec<StepSeqLight>,
    #[serde(default)]
    pub sequence_bank: Vec<Option<StepSeqPatternBank>>,
    #[serde(default)]
    pub active_bank_slot: usize,
}

#[tauri::command]
pub async fn save_sequence(path: String, data: StepSeqFile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn load_sequence(path: String) -> Result<StepSeqFile, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: StepSeqFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn auto_save_state(app_handle: tauri::AppHandle, state_json: String) -> Result<(), String> {
    use tauri::Manager;
    let doc_dir = app_handle.path().document_dir().map_err(|e| e.to_string())?;
    let app_dir = doc_dir.join("StepItOut");
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let file_path = app_dir.join("project_state.json");
    std::fs::write(&file_path, state_json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn auto_load_state(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let doc_dir = app_handle.path().document_dir().map_err(|e| e.to_string())?;
    let file_path = doc_dir.join("StepItOut").join("project_state.json");
    std::fs::read_to_string(&file_path).map_err(|e| e.to_string())
}
