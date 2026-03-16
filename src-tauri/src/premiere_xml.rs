use crate::commands::sequence::{StepSeqFile, StepSeqLight, StepSeqPatternBank};
use std::io::Read;

/// Convert a Windows path to a file://localhost/ URL for Premiere Pro.
fn path_to_file_url(path: &str) -> String {
    let path = path.replace('\\', "/");
    let encoded: String = path
        .chars()
        .map(|c| match c {
            ' ' => "%20".to_string(),
            '#' => "%23".to_string(),
            '%' => "%25".to_string(),
            '&' => "%26".to_string(),
            '+' => "%2B".to_string(),
            '/' => "/".to_string(),
            ':' => ":".to_string(),
            _ => c.to_string(),
        })
        .collect();
    format!("file://localhost/{}", encoded)
}

/// Read image dimensions from file header (PNG/JPEG). Falls back to 1920x1080.
fn read_image_dimensions(path: &str) -> (u32, u32) {
    let mut file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (1920, 1080),
    };
    let mut buf = [0u8; 65536];
    let n = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return (1920, 1080),
    };
    let data = &buf[..n];

    // PNG: magic bytes 0x89504E47, IHDR width at 16-19, height at 20-23
    if data.len() >= 24 && data[0] == 0x89 && data[1] == b'P' && data[2] == b'N' && data[3] == b'G' {
        let w = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
        let h = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
        return (w, h);
    }

    // JPEG: starts with 0xFFD8, find SOF0 (0xFFC0) or SOF2 (0xFFC2)
    if data.len() >= 2 && data[0] == 0xFF && data[1] == 0xD8 {
        let mut i = 2;
        while i + 9 < data.len() {
            if data[i] == 0xFF {
                let marker = data[i + 1];
                if marker == 0xC0 || marker == 0xC2 {
                    let h = u16::from_be_bytes([data[i + 5], data[i + 6]]) as u32;
                    let w = u16::from_be_bytes([data[i + 7], data[i + 8]]) as u32;
                    return (w, h);
                }
                if marker == 0xD9 || marker == 0xDA {
                    break;
                }
                if i + 3 < data.len() {
                    let seg_len = u16::from_be_bytes([data[i + 2], data[i + 3]]) as usize;
                    i += 2 + seg_len;
                } else {
                    break;
                }
            } else {
                i += 1;
            }
        }
    }

    (1920, 1080)
}

/// Bank group names and their slot ranges
const BANK_GROUPS: &[(&str, usize, usize)] = &[
    ("Build", 0, 8),
    ("Break", 8, 8),
    ("Drop", 16, 8),
    ("Custom", 24, 8),
];

/// Collect all non-empty bank slots grouped by category.
fn collect_bank_sequences(seq: &StepSeqFile) -> Vec<(String, &StepSeqPatternBank)> {
    let prefix = if seq.project_name.is_empty() {
        String::new()
    } else {
        format!("{} - ", seq.project_name)
    };

    let mut result = Vec::new();

    for &(group_name, start, count) in BANK_GROUPS {
        let mut slot_num = 0;
        for i in start..(start + count) {
            if let Some(Some(bank)) = seq.sequence_bank.get(i) {
                slot_num += 1;
                let name = format!("{}{} {}", prefix, group_name, slot_num);
                result.push((name, bank));
            }
        }
    }

    result
}

pub fn generate_fcp_xml(seq: &StepSeqFile) -> Result<String, String> {
    let timebase = seq.fps as i64;
    let total_frames = (seq.loop_seconds * seq.fps) as i64;

    // Read resolution from the first light's image file
    let (width, height) = if let Some(first_light) = seq.lights.first() {
        read_image_dimensions(&first_light.file_path)
    } else {
        (1920, 1080)
    };

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<!DOCTYPE xmeml>\n");
    xml.push_str("<xmeml version=\"5\">\n");
    xml.push_str("  <project>\n");
    let project_display_name = if seq.project_name.is_empty() {
        "STEP It Out Export".to_string()
    } else {
        seq.project_name.clone()
    };
    xml.push_str(&format!("    <name>{}</name>\n", escape_xml(&project_display_name)));
    xml.push_str("    <children>\n");

    // Emit master clips for each light (shared across all sequences)
    for (i, light) in seq.lights.iter().enumerate() {
        let file_id = format!("file-{}", i + 1);
        let clip_id = format!("masterclip-{}", i + 1);
        let path_url = path_to_file_url(&light.file_path);

        xml.push_str(&format!("      <clip id=\"{}\">\n", clip_id));
        xml.push_str(&format!("        <name>{}</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("        <duration>{}</duration>\n", total_frames));
        xml.push_str("        <rate>\n");
        xml.push_str(&format!("          <timebase>{}</timebase>\n", timebase));
        xml.push_str("          <ntsc>FALSE</ntsc>\n");
        xml.push_str("        </rate>\n");
        xml.push_str(&format!("        <file id=\"{}\">\n", file_id));
        xml.push_str(&format!("          <name>{}</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("          <pathurl>{}</pathurl>\n", path_url));
        xml.push_str(&format!("          <duration>{}</duration>\n", total_frames));
        xml.push_str("          <rate>\n");
        xml.push_str(&format!("            <timebase>{}</timebase>\n", timebase));
        xml.push_str("            <ntsc>FALSE</ntsc>\n");
        xml.push_str("          </rate>\n");
        xml.push_str("          <media>\n");
        xml.push_str("            <video>\n");
        xml.push_str("              <duration>1</duration>\n");
        xml.push_str("              <stillframe>TRUE</stillframe>\n");
        xml.push_str("              <samplecharacteristics>\n");
        xml.push_str(&format!("                <width>{}</width>\n", width));
        xml.push_str(&format!("                <height>{}</height>\n", height));
        xml.push_str("              </samplecharacteristics>\n");
        xml.push_str("            </video>\n");
        xml.push_str("          </media>\n");
        xml.push_str("        </file>\n");
        xml.push_str("      </clip>\n");
    }

    // Collect bank sequences to export
    let bank_sequences = collect_bank_sequences(seq);

    if bank_sequences.is_empty() {
        let fallback_name = if seq.project_name.is_empty() {
            "STEP It Out".to_string()
        } else {
            seq.project_name.clone()
        };
        write_sequence(&mut xml, &fallback_name, &seq.lights, timebase, total_frames, width, height);
    } else {
        for (seq_name, bank) in &bank_sequences {
            let overridden_lights: Vec<StepSeqLight> = seq.lights.iter().map(|light| {
                if let Some(layer_bank) = bank.layers.get(&light.id) {
                    StepSeqLight {
                        id: light.id.clone(),
                        name: light.name.clone(),
                        file_path: light.file_path.clone(),
                        division: layer_bank.division.as_str()
                            .unwrap_or(&light.division)
                            .to_string(),
                        pattern: layer_bank.pattern.clone(),
                        attack: layer_bank.attack.unwrap_or(light.attack),
                        decay: layer_bank.decay.unwrap_or(light.decay),
                        intensity: light.intensity,
                        curve: light.curve.clone(),
                        muted: light.muted,
                    }
                } else {
                    light.clone()
                }
            }).collect();

            let bank_total_frames = (bank.duration_seconds * seq.fps) as i64;
            write_sequence(&mut xml, seq_name, &overridden_lights, timebase, bank_total_frames, width, height);
        }
    }

    xml.push_str("    </children>\n");
    xml.push_str("  </project>\n");
    xml.push_str("</xmeml>\n");

    Ok(xml)
}

fn write_sequence(
    xml: &mut String,
    name: &str,
    lights: &[StepSeqLight],
    timebase: i64,
    total_frames: i64,
    width: u32,
    height: u32,
) {
    let seq_id = format!("sequence-{}", name.to_lowercase().replace(' ', "-"));

    xml.push_str(&format!("      <sequence id=\"{}\">\n", escape_xml(&seq_id)));
    xml.push_str(&format!("        <name>{}</name>\n", escape_xml(name)));
    xml.push_str(&format!("        <duration>{}</duration>\n", total_frames));
    xml.push_str("        <rate>\n");
    xml.push_str(&format!("          <timebase>{}</timebase>\n", timebase));
    xml.push_str("          <ntsc>FALSE</ntsc>\n");
    xml.push_str("        </rate>\n");
    xml.push_str("        <media>\n");
    xml.push_str("          <video>\n");
    xml.push_str("            <format>\n");
    xml.push_str("              <samplecharacteristics>\n");
    xml.push_str(&format!("                <width>{}</width>\n", width));
    xml.push_str(&format!("                <height>{}</height>\n", height));
    xml.push_str("              </samplecharacteristics>\n");
    xml.push_str("            </format>\n");

    // V1: Black solid base track for additive blending
    xml.push_str("            <track>\n");
    xml.push_str(&format!("              <generatoritem id=\"{}-black-solid\">\n", escape_xml(&seq_id)));
    xml.push_str("                <name>Black</name>\n");
    xml.push_str(&format!("                <duration>{}</duration>\n", total_frames));
    xml.push_str("                <rate>\n");
    xml.push_str(&format!("                  <timebase>{}</timebase>\n", timebase));
    xml.push_str("                  <ntsc>FALSE</ntsc>\n");
    xml.push_str("                </rate>\n");
    xml.push_str("                <start>0</start>\n");
    xml.push_str(&format!("                <end>{}</end>\n", total_frames));
    xml.push_str("                <in>0</in>\n");
    xml.push_str(&format!("                <out>{}</out>\n", total_frames));
    xml.push_str("                <effect>\n");
    xml.push_str("                  <name>Slug</name>\n");
    xml.push_str("                  <effectid>slug</effectid>\n");
    xml.push_str("                  <effecttype>generator</effecttype>\n");
    xml.push_str("                  <mediatype>video</mediatype>\n");
    xml.push_str("                </effect>\n");
    xml.push_str("              </generatoritem>\n");
    xml.push_str("            </track>\n");

    // Light layer tracks (V2+): group consecutive non-zero frames into clip runs
    for (i, light) in lights.iter().enumerate() {
        let file_id = format!("file-{}", i + 1);
        let clip_id = format!("masterclip-{}", i + 1);

        let total = total_frames as u32;
        if total == 0 || light.pattern.is_empty() { continue; }

        xml.push_str("            <track>\n");

        let mut clip_counter = 0u32;
        let pat_len = light.pattern.len();
        let mut fi = 0usize;

        while fi < pat_len {
            if light.pattern[fi] == 0 {
                fi += 1;
                continue;
            }
            // Found start of a run of active frames
            let run_start = fi as u32;
            while fi < pat_len && light.pattern[fi] != 0 {
                fi += 1;
            }
            let run_end = (fi as u32).min(total);
            let clip_len = run_end - run_start;
            if clip_len == 0 { continue; }
            clip_counter += 1;

            let item_id = format!("{}-clip-{}-{}", escape_xml(&seq_id), i + 1, clip_counter);

            xml.push_str(&format!("              <clipitem id=\"{}\">\n", item_id));
            xml.push_str(&format!("                <name>{}</name>\n", escape_xml(&light.name)));
            xml.push_str(&format!("                <duration>{}</duration>\n", total_frames));
            xml.push_str("                <rate>\n");
            xml.push_str(&format!("                  <timebase>{}</timebase>\n", timebase));
            xml.push_str("                  <ntsc>FALSE</ntsc>\n");
            xml.push_str("                </rate>\n");
            xml.push_str(&format!("                <start>{}</start>\n", run_start));
            xml.push_str(&format!("                <end>{}</end>\n", run_end));
            xml.push_str("                <in>0</in>\n");
            xml.push_str(&format!("                <out>{}</out>\n", clip_len));
            xml.push_str(&format!("                <masterclipid>{}</masterclipid>\n", clip_id));
            xml.push_str(&format!("                <file id=\"{}\"/>\n", file_id));
            xml.push_str("                <compositemode>add</compositemode>\n");

            // Opacity envelope: attack → hold → decay (in frames, relative to clip start)
            let attack = light.attack.min(clip_len);
            let decay = light.decay.min(clip_len);
            let intensity_pct = (light.intensity * 100.0).min(100.0);
            let needs_envelope = attack > 0 || decay > 0 || intensity_pct < 100.0;

            if needs_envelope {
                xml.push_str("                <filter>\n");
                xml.push_str("                  <effect>\n");
                xml.push_str("                    <name>Opacity</name>\n");
                xml.push_str("                    <effectid>opacity</effectid>\n");
                xml.push_str("                    <effecttype>filter</effecttype>\n");
                xml.push_str("                    <mediatype>video</mediatype>\n");
                xml.push_str("                    <parameter>\n");
                xml.push_str("                      <parameterid>opacity</parameterid>\n");
                xml.push_str("                      <name>Opacity</name>\n");

                if attack > 0 {
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str("                        <when>0</when>\n");
                    xml.push_str("                        <value>0.0</value>\n");
                    xml.push_str("                      </keyframe>\n");
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str(&format!("                        <when>{}</when>\n", attack));
                    xml.push_str(&format!("                        <value>{:.1}</value>\n", intensity_pct));
                    xml.push_str("                      </keyframe>\n");
                } else {
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str("                        <when>0</when>\n");
                    xml.push_str(&format!("                        <value>{:.1}</value>\n", intensity_pct));
                    xml.push_str("                      </keyframe>\n");
                }

                if decay > 0 {
                    let decay_start = clip_len.saturating_sub(decay);
                    if decay_start > attack {
                        xml.push_str("                      <keyframe>\n");
                        xml.push_str(&format!("                        <when>{}</when>\n", decay_start));
                        xml.push_str(&format!("                        <value>{:.1}</value>\n", intensity_pct));
                        xml.push_str("                      </keyframe>\n");
                    }
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str(&format!("                        <when>{}</when>\n", clip_len));
                    xml.push_str("                        <value>0.0</value>\n");
                    xml.push_str("                      </keyframe>\n");
                } else if intensity_pct < 100.0 {
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str(&format!("                        <when>{}</when>\n", clip_len));
                    xml.push_str(&format!("                        <value>{:.1}</value>\n", intensity_pct));
                    xml.push_str("                      </keyframe>\n");
                }

                xml.push_str("                    </parameter>\n");
                xml.push_str("                  </effect>\n");
                xml.push_str("                </filter>\n");
            }

            xml.push_str("              </clipitem>\n");
        }

        xml.push_str("            </track>\n");
    }

    xml.push_str("          </video>\n");
    xml.push_str("        </media>\n");
    xml.push_str("      </sequence>\n");
}

// ─── Track Matte export mode ───────────────────────────────────────────────

pub fn generate_fcp_xml_matte(seq: &StepSeqFile) -> Result<String, String> {
    let timebase = seq.fps as i64;
    let total_frames = (seq.loop_seconds * seq.fps) as i64;

    let (width, height) = if let Some(first_light) = seq.lights.first() {
        read_image_dimensions(&first_light.file_path)
    } else {
        (1920, 1080)
    };

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<!DOCTYPE xmeml>\n");
    xml.push_str("<xmeml version=\"5\">\n");
    xml.push_str("  <project>\n");
    let project_display_name = if seq.project_name.is_empty() {
        "STEP It Out Export".to_string()
    } else {
        seq.project_name.clone()
    };
    xml.push_str(&format!("    <name>{}</name>\n", escape_xml(&project_display_name)));
    xml.push_str("    <children>\n");

    // Master clips
    for (i, light) in seq.lights.iter().enumerate() {
        let file_id = format!("file-{}", i + 1);
        let clip_id = format!("masterclip-{}", i + 1);
        let path_url = path_to_file_url(&light.file_path);

        xml.push_str(&format!("      <clip id=\"{}\">\n", clip_id));
        xml.push_str(&format!("        <name>{}</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("        <duration>{}</duration>\n", total_frames));
        xml.push_str("        <rate>\n");
        xml.push_str(&format!("          <timebase>{}</timebase>\n", timebase));
        xml.push_str("          <ntsc>FALSE</ntsc>\n");
        xml.push_str("        </rate>\n");
        xml.push_str(&format!("        <file id=\"{}\">\n", file_id));
        xml.push_str(&format!("          <name>{}</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("          <pathurl>{}</pathurl>\n", path_url));
        xml.push_str(&format!("          <duration>{}</duration>\n", total_frames));
        xml.push_str("          <rate>\n");
        xml.push_str(&format!("            <timebase>{}</timebase>\n", timebase));
        xml.push_str("            <ntsc>FALSE</ntsc>\n");
        xml.push_str("          </rate>\n");
        xml.push_str("          <media>\n");
        xml.push_str("            <video>\n");
        xml.push_str("              <duration>1</duration>\n");
        xml.push_str("              <stillframe>TRUE</stillframe>\n");
        xml.push_str("              <samplecharacteristics>\n");
        xml.push_str(&format!("                <width>{}</width>\n", width));
        xml.push_str(&format!("                <height>{}</height>\n", height));
        xml.push_str("              </samplecharacteristics>\n");
        xml.push_str("            </video>\n");
        xml.push_str("          </media>\n");
        xml.push_str("        </file>\n");
        xml.push_str("      </clip>\n");
    }

    let bank_sequences = collect_bank_sequences(seq);

    if bank_sequences.is_empty() {
        let fallback_name = if seq.project_name.is_empty() {
            "STEP It Out".to_string()
        } else {
            seq.project_name.clone()
        };
        write_matte_sequence(&mut xml, &fallback_name, &seq.lights, timebase, total_frames, width, height);
    } else {
        for (seq_name, bank) in &bank_sequences {
            let overridden_lights: Vec<StepSeqLight> = seq.lights.iter().map(|light| {
                if let Some(layer_bank) = bank.layers.get(&light.id) {
                    StepSeqLight {
                        id: light.id.clone(),
                        name: light.name.clone(),
                        file_path: light.file_path.clone(),
                        division: layer_bank.division.as_str()
                            .unwrap_or(&light.division)
                            .to_string(),
                        pattern: layer_bank.pattern.clone(),
                        attack: layer_bank.attack.unwrap_or(light.attack),
                        decay: layer_bank.decay.unwrap_or(light.decay),
                        intensity: light.intensity,
                        curve: light.curve.clone(),
                        muted: light.muted,
                    }
                } else {
                    light.clone()
                }
            }).collect();

            let bank_total_frames = (bank.duration_seconds * seq.fps) as i64;
            write_matte_sequence(&mut xml, seq_name, &overridden_lights, timebase, bank_total_frames, width, height);
        }
    }

    xml.push_str("    </children>\n");
    xml.push_str("  </project>\n");
    xml.push_str("</xmeml>\n");

    Ok(xml)
}

fn write_matte_sequence(
    xml: &mut String,
    name: &str,
    lights: &[StepSeqLight],
    timebase: i64,
    total_frames: i64,
    width: u32,
    height: u32,
) {
    let seq_id = format!("sequence-{}", name.to_lowercase().replace(' ', "-"));

    xml.push_str(&format!("      <sequence id=\"{}\">\n", escape_xml(&seq_id)));
    xml.push_str(&format!("        <name>{}</name>\n", escape_xml(name)));
    xml.push_str(&format!("        <duration>{}</duration>\n", total_frames));
    xml.push_str("        <rate>\n");
    xml.push_str(&format!("          <timebase>{}</timebase>\n", timebase));
    xml.push_str("          <ntsc>FALSE</ntsc>\n");
    xml.push_str("        </rate>\n");
    xml.push_str("        <media>\n");
    xml.push_str("          <video>\n");
    xml.push_str("            <format>\n");
    xml.push_str("              <samplecharacteristics>\n");
    xml.push_str(&format!("                <width>{}</width>\n", width));
    xml.push_str(&format!("                <height>{}</height>\n", height));
    xml.push_str("              </samplecharacteristics>\n");
    xml.push_str("            </format>\n");

    // V1: Black solid base
    xml.push_str("            <track>\n");
    xml.push_str(&format!("              <generatoritem id=\"{}-black\">\n", escape_xml(&seq_id)));
    xml.push_str("                <name>Black</name>\n");
    xml.push_str(&format!("                <duration>{}</duration>\n", total_frames));
    xml.push_str("                <rate>\n");
    xml.push_str(&format!("                  <timebase>{}</timebase>\n", timebase));
    xml.push_str("                  <ntsc>FALSE</ntsc>\n");
    xml.push_str("                </rate>\n");
    xml.push_str("                <start>0</start>\n");
    xml.push_str(&format!("                <end>{}</end>\n", total_frames));
    xml.push_str("                <in>0</in>\n");
    xml.push_str(&format!("                <out>{}</out>\n", total_frames));
    xml.push_str("                <effect>\n");
    xml.push_str("                  <name>Slug</name>\n");
    xml.push_str("                  <effectid>slug</effectid>\n");
    xml.push_str("                  <effecttype>generator</effecttype>\n");
    xml.push_str("                  <mediatype>video</mediatype>\n");
    xml.push_str("                </effect>\n");
    xml.push_str("              </generatoritem>\n");
    xml.push_str("            </track>\n");

    // For each light: image track + white solid matte track above it
    for (i, light) in lights.iter().enumerate() {
        let file_id = format!("file-{}", i + 1);
        let clip_id = format!("masterclip-{}", i + 1);

        // Image track — full length, normal blend, with Track Matte Key filter
        xml.push_str("            <track>\n");
        xml.push_str(&format!("              <clipitem id=\"{}-img-{}\">\n", escape_xml(&seq_id), i + 1));
        xml.push_str(&format!("                <name>{}</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("                <duration>{}</duration>\n", total_frames));
        xml.push_str("                <rate>\n");
        xml.push_str(&format!("                  <timebase>{}</timebase>\n", timebase));
        xml.push_str("                  <ntsc>FALSE</ntsc>\n");
        xml.push_str("                </rate>\n");
        xml.push_str("                <start>0</start>\n");
        xml.push_str(&format!("                <end>{}</end>\n", total_frames));
        xml.push_str("                <in>0</in>\n");
        xml.push_str(&format!("                <out>{}</out>\n", total_frames));
        xml.push_str(&format!("                <masterclipid>{}</masterclipid>\n", clip_id));
        xml.push_str(&format!("                <file id=\"{}\"/>\n", file_id));
        xml.push_str("                <filter>\n");
        xml.push_str("                  <effect>\n");
        xml.push_str("                    <name>Track Matte Key</name>\n");
        xml.push_str("                    <effectid>trackmattekey</effectid>\n");
        xml.push_str("                    <effecttype>filter</effecttype>\n");
        xml.push_str("                    <mediatype>video</mediatype>\n");
        xml.push_str("                    <parameter>\n");
        xml.push_str("                      <parameterid>trackmattetype</parameterid>\n");
        xml.push_str("                      <name>Matte</name>\n");
        xml.push_str("                      <value>1</value>\n");
        xml.push_str("                    </parameter>\n");
        xml.push_str("                  </effect>\n");
        xml.push_str("                </filter>\n");
        xml.push_str("              </clipitem>\n");
        xml.push_str("            </track>\n");

        // White solid matte track — opacity keyframes drive visibility
        xml.push_str("            <track>\n");
        xml.push_str(&format!("              <generatoritem id=\"{}-matte-{}\">\n", escape_xml(&seq_id), i + 1));
        xml.push_str(&format!("                <name>{} Matte</name>\n", escape_xml(&light.name)));
        xml.push_str(&format!("                <duration>{}</duration>\n", total_frames));
        xml.push_str("                <rate>\n");
        xml.push_str(&format!("                  <timebase>{}</timebase>\n", timebase));
        xml.push_str("                  <ntsc>FALSE</ntsc>\n");
        xml.push_str("                </rate>\n");
        xml.push_str("                <start>0</start>\n");
        xml.push_str(&format!("                <end>{}</end>\n", total_frames));
        xml.push_str("                <in>0</in>\n");
        xml.push_str(&format!("                <out>{}</out>\n", total_frames));
        xml.push_str("                <effect>\n");
        xml.push_str("                  <name>Slug</name>\n");
        xml.push_str("                  <effectid>slug</effectid>\n");
        xml.push_str("                  <effecttype>generator</effecttype>\n");
        xml.push_str("                  <mediatype>video</mediatype>\n");
        xml.push_str("                </effect>\n");

        // Opacity keyframes on the white solid
        let total = total_frames as u32;
        if total > 0 && !light.pattern.is_empty() {
            let keyframes = generate_matte_keyframes(light, total);
            if !keyframes.is_empty() {
                xml.push_str("                <filter>\n");
                xml.push_str("                  <effect>\n");
                xml.push_str("                    <name>Opacity</name>\n");
                xml.push_str("                    <effectid>opacity</effectid>\n");
                xml.push_str("                    <effecttype>filter</effecttype>\n");
                xml.push_str("                    <mediatype>video</mediatype>\n");
                xml.push_str("                    <parameter>\n");
                xml.push_str("                      <parameterid>opacity</parameterid>\n");
                xml.push_str("                      <name>Opacity</name>\n");
                for kf in &keyframes {
                    xml.push_str("                      <keyframe>\n");
                    xml.push_str(&format!("                        <when>{}</when>\n", kf.frame));
                    xml.push_str(&format!("                        <value>{:.1}</value>\n", kf.opacity));
                    xml.push_str("                      </keyframe>\n");
                }
                xml.push_str("                    </parameter>\n");
                xml.push_str("                  </effect>\n");
                xml.push_str("                </filter>\n");
            }
        }

        xml.push_str("              </generatoritem>\n");
        xml.push_str("            </track>\n");
    }

    xml.push_str("          </video>\n");
    xml.push_str("        </media>\n");
    xml.push_str("      </sequence>\n");
}

struct OpacityKeyframe {
    frame: i64,
    opacity: f64,
}

fn generate_matte_keyframes(light: &StepSeqLight, total_frames: u32) -> Vec<OpacityKeyframe> {
    let mut keyframes = Vec::new();
    let intensity_pct = (light.intensity * 100.0).min(100.0);
    let pat_len = light.pattern.len();

    // Seed with 0 at frame 0
    keyframes.push(OpacityKeyframe { frame: 0, opacity: 0.0 });

    let mut fi = 0usize;
    while fi < pat_len {
        if light.pattern[fi] == 0 {
            // Drop to 0 if previous was non-zero
            let frame = fi as i64;
            if keyframes.last().map(|k: &OpacityKeyframe| k.opacity).unwrap_or(0.0) != 0.0 {
                keyframes.push(OpacityKeyframe { frame, opacity: 0.0 });
            }
            fi += 1;
            continue;
        }

        // Start of a run of active frames
        let run_start = fi as u32;
        while fi < pat_len && light.pattern[fi] != 0 {
            fi += 1;
        }
        let run_end = (fi as u32).min(total_frames);
        let clip_len = run_end - run_start;
        if clip_len == 0 { continue; }

        let attack = light.attack.min(clip_len);
        let decay = light.decay.min(clip_len);

        // Ensure 0 at run start if not already
        if keyframes.last().map(|k| k.opacity).unwrap_or(0.0) != 0.0 {
            keyframes.push(OpacityKeyframe { frame: run_start as i64, opacity: 0.0 });
        }

        if attack > 0 {
            keyframes.push(OpacityKeyframe { frame: (run_start + attack) as i64, opacity: intensity_pct });
        } else {
            keyframes.push(OpacityKeyframe { frame: run_start as i64, opacity: intensity_pct });
        }

        if decay > 0 {
            let decay_start = run_end.saturating_sub(decay);
            if decay_start > run_start + attack {
                keyframes.push(OpacityKeyframe { frame: decay_start as i64, opacity: intensity_pct });
            }
            keyframes.push(OpacityKeyframe { frame: run_end as i64, opacity: 0.0 });
        } else {
            keyframes.push(OpacityKeyframe { frame: run_end as i64, opacity: 0.0 });
        }
    }

    // Ensure final frame is 0
    if keyframes.last().map(|k| k.frame).unwrap_or(-1) < total_frames as i64 {
        keyframes.push(OpacityKeyframe { frame: total_frames as i64, opacity: 0.0 });
    }

    keyframes
}


fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
