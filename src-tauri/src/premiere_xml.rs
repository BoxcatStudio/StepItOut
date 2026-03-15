use crate::commands::sequence::{StepSeqFile, StepSeqLight, StepSeqPatternBank};

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
            ';' => "%3B".to_string(),
            '=' => "%3D".to_string(),
            '?' => "%3F".to_string(),
            '@' => "%40".to_string(),
            _ => c.to_string(),
        })
        .collect();
    format!("file://localhost/{}", encoded)
}

/// Bank group names and their slot ranges
const BANK_GROUPS: &[(&str, usize, usize)] = &[
    ("Build", 0, 8),
    ("Break", 8, 8),
    ("Drop", 16, 8),
    ("Custom", 24, 8),
];

/// Collect all non-empty bank slots grouped by category.
/// Returns (group_name, slot_index, bank) for each populated slot.
fn collect_bank_sequences(seq: &StepSeqFile) -> Vec<(String, &StepSeqPatternBank)> {
    let mut result = Vec::new();

    for &(group_name, start, count) in BANK_GROUPS {
        let mut slot_num = 0;
        for i in start..(start + count) {
            if let Some(Some(bank)) = seq.sequence_bank.get(i) {
                slot_num += 1;
                let name = if count == 1 || slot_num == 1 {
                    group_name.to_string()
                } else {
                    format!("{} {}", group_name, slot_num)
                };
                result.push((name, bank));
            }
        }
    }

    result
}

pub fn generate_fcp_xml(seq: &StepSeqFile) -> Result<String, String> {
    let timebase = seq.fps as i64;
    let total_frames = (seq.loop_seconds * seq.fps) as i64;

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<!DOCTYPE xmeml>\n");
    xml.push_str("<xmeml version=\"5\">\n");
    xml.push_str("  <project>\n");
    xml.push_str("    <name>STEP It Out Export</name>\n");
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
        xml.push_str("        </file>\n");
        xml.push_str("      </clip>\n");
    }

    // Collect bank sequences to export
    let bank_sequences = collect_bank_sequences(seq);

    if bank_sequences.is_empty() {
        // No banks populated — export the current active sequence as a single timeline
        write_sequence(&mut xml, "STEP It Out", seq, &seq.lights, timebase, total_frames);
    } else {
        // Export each populated bank as its own sequence/timeline
        for (seq_name, bank) in &bank_sequences {
            // Build overridden lights for this bank
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
                    }
                } else {
                    light.clone()
                }
            }).collect();

            let bank_total_frames = (bank.duration_seconds * seq.fps) as i64;
            write_sequence(&mut xml, seq_name, seq, &overridden_lights, timebase, bank_total_frames);
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
    seq: &StepSeqFile,
    lights: &[StepSeqLight],
    timebase: i64,
    total_frames: i64,
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

    for (i, light) in lights.iter().enumerate() {
        let file_id = format!("file-{}", i + 1);
        let clip_id = format!("masterclip-{}", i + 1);

        xml.push_str("            <track>\n");
        xml.push_str(&format!("              <clipitem id=\"{}-clipitem-{}\">\n", escape_xml(&seq_id), i + 1));
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
        xml.push_str("                <compositemode>add</compositemode>\n");
        xml.push_str(&format!("                <file id=\"{}\"/>\n", file_id));

        let keyframes = generate_opacity_keyframes(light, seq.fps, total_frames);
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

        xml.push_str("              </clipitem>\n");
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

fn generate_opacity_keyframes(light: &StepSeqLight, _fps: u32, total_frames: i64) -> Vec<OpacityKeyframe> {
    let total = total_frames as u32;
    let steps = steps_for_division(&light.division, total);
    if steps == 0 {
        return Vec::new();
    }
    let step_duration = total / steps;
    if step_duration == 0 {
        return Vec::new();
    }

    let mut keyframes = Vec::new();
    let mut prev_opacity: Option<f64> = None;

    for f in 0..total {
        let opacity = opacity_at_frame(light, f, total, steps, step_duration);
        let opacity_pct = (opacity * 100.0).min(100.0);

        let emit = match prev_opacity {
            None => true,
            Some(prev) => (opacity_pct - prev).abs() > 0.01,
        };

        if emit {
            // If the previous frame was different and wasn't the frame right before,
            // emit the previous value at (f-1) to create a clean transition edge
            if let Some(prev) = prev_opacity {
                if keyframes.last().map(|k: &OpacityKeyframe| k.frame).unwrap_or(-2) < (f as i64 - 1) {
                    keyframes.push(OpacityKeyframe {
                        frame: f as i64 - 1,
                        opacity: prev,
                    });
                }
            }
            keyframes.push(OpacityKeyframe {
                frame: f as i64,
                opacity: opacity_pct,
            });
        }

        prev_opacity = Some(opacity_pct);
    }

    // Ensure we have a final keyframe
    if let Some(prev) = prev_opacity {
        if keyframes.last().map(|k| k.frame).unwrap_or(-1) < (total as i64 - 1) {
            keyframes.push(OpacityKeyframe {
                frame: total as i64 - 1,
                opacity: prev,
            });
        }
    }

    keyframes
}

fn opacity_at_frame(light: &StepSeqLight, frame: u32, total_frames: u32, _steps: u32, step_duration: u32) -> f64 {
    let mut max_opacity = 0.0_f64;

    for (i, &p) in light.pattern.iter().enumerate() {
        if p == 0 {
            continue;
        }
        let start_frame = (i as u32 * step_duration) % total_frames;
        let attack = light.attack.min(step_duration);
        let decay = light.decay.min(step_duration);
        let hold = step_duration.saturating_sub(attack).saturating_sub(decay);

        let local = (frame as i64 - start_frame as i64 + total_frames as i64) % total_frames as i64;
        let local = local as u32;

        let opacity = if local < attack {
            if attack > 0 { local as f64 / attack as f64 } else { 1.0 }
        } else if local < attack + hold {
            1.0
        } else if local < attack + hold + decay {
            let t = local - attack - hold;
            if decay > 0 { 1.0 - t as f64 / decay as f64 } else { 0.0 }
        } else {
            0.0
        };

        max_opacity = max_opacity.max(opacity);
    }

    (max_opacity * light.intensity).min(1.0)
}

fn steps_for_division(division: &str, total_frames: u32) -> u32 {
    match division {
        "1" => total_frames,
        "2" => total_frames / 2,
        "5" => total_frames / 5,
        "10" => total_frames / 10,
        "15" => total_frames / 15,
        "30" => total_frames / 30,
        "1/4" => 4,
        "1/8" => 8,
        "1/16" => 16,
        "1/32" => 32,
        "frame" => total_frames,
        _ => {
            // Try parsing as a number (the frontend Division type uses numbers 1|2|5|10|15|30)
            if let Ok(n) = division.parse::<u32>() {
                if n > 0 { total_frames / n } else { 8 }
            } else {
                8
            }
        }
    }
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
