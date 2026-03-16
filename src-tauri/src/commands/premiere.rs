use crate::commands::sequence::StepSeqFile;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ExportRequest {
    pub sequence: StepSeqFile,
    pub output_path: String,
    #[serde(default)]
    pub export_mode: String,
}

#[tauri::command]
pub async fn export_to_premiere(request: ExportRequest) -> Result<String, String> {
    // Strip muted lights before export
    let mut seq = request.sequence;
    seq.lights.retain(|l| !l.muted);

    let xml = if request.export_mode == "matte" {
        crate::premiere_xml::generate_fcp_xml_matte(&seq)?
    } else {
        crate::premiere_xml::generate_fcp_xml(&seq)?
    };
    std::fs::write(&request.output_path, &xml).map_err(|e| e.to_string())?;
    Ok(request.output_path)
}
