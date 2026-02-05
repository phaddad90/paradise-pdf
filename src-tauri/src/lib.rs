//! Paradise PDF — Rust backend.
//! File layer: listing, rename. PDF layer: split, (future: merge, compress).

use lopdf::Document;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreviewResult {
    pub preview_names: Vec<String>,
    pub placeholder_found: bool,
    pub overwrite_warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameFailure {
    pub path: String,
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    pub renamed: u32,
    pub failed: Vec<RenameFailure>,
}

/// Parse template: find version placeholder and its minimum digit width.
/// Placeholders: one or more '#' (e.g. #, ##, ###) or literal "{version}".
/// Returns (placeholder_pattern, min_digits). Pattern is the exact string to replace.
fn parse_placeholder(template: &str) -> Option<(String, usize)> {
    if template.is_empty() {
        return None;
    }
    let mut chars = template.char_indices().peekable();
    while let Some((i, c)) = chars.next() {
        if c == '#' {
            let start = i;
            let mut count = 1usize;
            while chars.next_if(|(_, ch)| *ch == '#').is_some() {
                count += 1;
            }
            return Some((template[start..start + count].to_string(), count));
        }
        if c == '{' && template[i..].starts_with("{version}") {
            return Some(("{version}".to_string(), 2));
        }
    }
    None
}

/// Zero-padded version string for index (1-based) with at least min_digits, or more if count needs it.
fn version_string(index: u32, file_count: u32, min_digits: usize) -> String {
    let digits = (file_count as f64).log10().floor() as usize + 1;
    let width = min_digits.max(digits).max(1);
    format!("{:0width$}", index, width = width)
}

/// Generate the new base name (no extension) for the given 1-based index.
fn apply_template(template: &str, index: u32, file_count: u32) -> Option<String> {
    let (placeholder, min_digits) = parse_placeholder(template)?;
    let version = version_string(index, file_count, min_digits);
    Some(
        template
            .replacen(&placeholder, &version, 1),
    )
}

/// List files from a set of paths. Each path can be a file or a directory.
/// Directories are expanded to their direct children (files only, no recursion).
/// Returns entries sorted alphabetically by full filename (stable order for rename).
#[tauri::command]
fn list_files_from_paths(paths: Vec<String>) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    for path in paths {
        let p = Path::new(&path);
        if !p.exists() {
            return Err(format!("Path does not exist: {}", path));
        }
        if p.is_file() {
            let name = p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            entries.push(FileEntry {
                path: path.clone(),
                name,
            });
        } else if p.is_dir() {
            let mut dir_entries: Vec<FileEntry> = fs::read_dir(&path)
                .map_err(|e| format!("Cannot read directory: {}", e))?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_file())
                .map(|e| {
                    let path = e.path();
                    let path_str = path.to_string_lossy().to_string();
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    FileEntry {
                        path: path_str,
                        name,
                    }
                })
                .collect();
            entries.append(&mut dir_entries);
        }
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

/// Validate template and return preview (first 3 names) and any overwrite warnings.
/// Extensions are preserved from the provided file names.
#[tauri::command]
fn validate_template(
    template: String,
    file_entries: Vec<FileEntry>,
) -> Result<PreviewResult, String> {
    let count = file_entries.len() as u32;
    if count == 0 {
        return Ok(PreviewResult {
            preview_names: vec![],
            placeholder_found: parse_placeholder(&template).is_some(),
            overwrite_warnings: vec![],
        });
    }
    let placeholder_found = parse_placeholder(&template).is_some();
    if !placeholder_found {
        return Ok(PreviewResult {
            preview_names: vec![],
            placeholder_found: false,
            overwrite_warnings: vec![],
        });
    }
    let mut preview_names = Vec::new();
    let mut overwrite_warnings = Vec::new();
    let existing_paths: std::collections::HashSet<String> =
        file_entries.iter().map(|e| e.path.clone()).collect();
    for (i, entry) in file_entries.iter().enumerate() {
        let index = (i + 1) as u32;
        let base = match apply_template(&template, index, count) {
            Some(b) => b,
            None => continue,
        };
        let ext = Path::new(&entry.name)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| format!(".{}", s))
            .unwrap_or_default();
        let new_name = format!("{}{}", base, ext);
        let parent = Path::new(&entry.path).parent().unwrap_or(Path::new("."));
        let new_path = parent.join(&new_name);
        let new_path_str = new_path.to_string_lossy().to_string();
        if i < 3 {
            preview_names.push(new_name);
        }
        if new_path.exists() && !existing_paths.contains(&new_path_str) {
            overwrite_warnings.push(new_path_str);
        }
    }
    Ok(PreviewResult {
        preview_names,
        placeholder_found: true,
        overwrite_warnings,
    })
}

/// Perform batch rename. Files are already in the desired order (e.g. alphabetical).
/// v2: could push (old_path, new_path) to an undo log for "Undo last rename".
#[tauri::command]
fn batch_rename(
    file_entries: Vec<FileEntry>,
    template: String,
) -> Result<RenameResult, String> {
    let count = file_entries.len() as u32;
    if count == 0 {
        return Ok(RenameResult {
            renamed: 0,
            failed: vec![],
        });
    }
    if parse_placeholder(&template).is_none() {
        return Err("Template has no version placeholder (# or {version}).".to_string());
    }
    let mut renamed = 0u32;
    let mut failed = Vec::new();
    let existing_paths: std::collections::HashSet<String> =
        file_entries.iter().map(|e| e.path.clone()).collect();
    for (i, entry) in file_entries.iter().enumerate() {
        let index = (i + 1) as u32;
        let base = match apply_template(&template, index, count) {
            Some(b) => b,
            None => {
                failed.push(RenameFailure {
                    path: entry.path.clone(),
                    error: "Could not apply template.".to_string(),
                });
                continue;
            }
        };
        let ext = Path::new(&entry.name)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| format!(".{}", s))
            .unwrap_or_default();
        let new_name = format!("{}{}", base, ext);
        let parent = Path::new(&entry.path).parent().unwrap_or(Path::new("."));
        let new_path = parent.join(&new_name);
        let new_path_str = new_path.to_string_lossy().to_string();
        if new_path_str == entry.path {
            renamed += 1;
            continue;
        }
        if new_path.exists() && !existing_paths.contains(&new_path_str) {
            failed.push(RenameFailure {
                path: entry.path.clone(),
                error: format!("Would overwrite existing file: {}", new_path_str),
            });
            continue;
        }
        if let Err(e) = fs::rename(&entry.path, &new_path) {
            failed.push(RenameFailure {
                path: entry.path.clone(),
                error: e.to_string(),
            });
        } else {
            renamed += 1;
        }
    }
    Ok(RenameResult { renamed, failed })
}

// --- PDF splitter (v2) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum SplitMode {
    EveryN { n: u32 },
    OnePerPage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitPreviewItem {
    pub output_name: String,
    pub page_range: String, // e.g. "1–5", "6–10"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitPreviewResult {
    pub source_name: String,
    pub page_count: u32,
    pub parts: Vec<SplitPreviewItem>,
}

/// Get page count of a PDF (for preview).
#[tauri::command]
fn pdf_page_count(path: String) -> Result<u32, String> {
    let path = Path::new(&path);
    if !path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    let doc = Document::load(path).map_err(|e| e.to_string())?;
    let pages = doc.get_pages();
    Ok(pages.len() as u32)
}

/// Preview split: returns output names and page ranges. Does not write files.
#[tauri::command]
fn split_pdf_preview(
    path: String,
    mode: SplitMode,
) -> Result<SplitPreviewResult, String> {
    let path = Path::new(&path);
    if !path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    let doc = Document::load(path).map_err(|e| e.to_string())?;
    let pages = doc.get_pages();
    let page_count = pages.len() as u32;
    if page_count == 0 {
        return Err("PDF has no pages.".to_string());
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document")
        .to_string();
    let source_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    let chunk_ranges: Vec<(u32, u32)> = match &mode {
        SplitMode::OnePerPage => (1..=page_count).map(|p| (p, p)).collect(),
        SplitMode::EveryN { n } => {
            let n = (*n).max(1);
            let mut ranges = Vec::new();
            let mut start = 1u32;
            while start <= page_count {
                let end = (start + n - 1).min(page_count);
                ranges.push((start, end));
                start = end + 1;
            }
            ranges
        }
    };

    let parts: Vec<SplitPreviewItem> = chunk_ranges
        .iter()
        .enumerate()
        .map(|(i, &(s, e))| {
            let output_name = format!("{}_part{}.pdf", stem, i + 1);
            let page_range = if s == e {
                format!("{}", s)
            } else {
                format!("{}–{}", s, e)
            };
            SplitPreviewItem {
                output_name,
                page_range,
            }
        })
        .collect();

    Ok(SplitPreviewResult {
        source_name,
        page_count,
        parts,
    })
}

/// Perform PDF split. output_dir: None = same folder as source; Some(path) = use that folder.
#[tauri::command]
fn split_pdf(
    source_path: String,
    output_dir: Option<String>,
    mode: SplitMode,
) -> Result<Vec<String>, String> {
    let path = Path::new(&source_path);
    if !path.is_file() {
        return Err("Path is not a file.".to_string());
    }
    let doc = Document::load(&path).map_err(|e| e.to_string())?;
    let pages = doc.get_pages();
    let page_count = pages.len() as u32;
    if page_count == 0 {
        return Err("PDF has no pages.".to_string());
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document")
        .to_string();
    let out_dir = match &output_dir {
        Some(d) => Path::new(d),
        None => path.parent().unwrap_or_else(|| Path::new(".")),
    };
    if !out_dir.is_dir() {
        return Err("Output path is not a directory.".to_string());
    }

    let chunk_ranges: Vec<(u32, u32)> = match &mode {
        SplitMode::OnePerPage => (1..=page_count).map(|p| (p, p)).collect(),
        SplitMode::EveryN { n } => {
            let n = (*n).max(1);
            let mut ranges = Vec::new();
            let mut start = 1u32;
            while start <= page_count {
                let end = (start + n - 1).min(page_count);
                ranges.push((start, end));
                start = end + 1;
            }
            ranges
        }
    };

    let mut saved = Vec::new();
    for (i, &(start, end)) in chunk_ranges.iter().enumerate() {
        let to_delete: Vec<u32> = (1..=page_count)
            .filter(|&p| p < start || p > end)
            .collect();
        let mut part_doc = doc.clone();
        part_doc.delete_pages(&to_delete);
        part_doc.prune_objects();
        part_doc.renumber_objects();
        let out_name = format!("{}_part{}.pdf", stem, i + 1);
        let out_path = out_dir.join(&out_name);
        let out_path_str = out_path.to_string_lossy().to_string();
        part_doc.save(&out_path).map_err(|e| e.to_string())?;
        saved.push(out_path_str);
    }
    Ok(saved)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    const LOCALHOST_PORT: u16 = 1420;
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build())
        .invoke_handler(tauri::generate_handler![
            list_files_from_paths,
            validate_template,
            batch_rename,
            pdf_page_count,
            split_pdf_preview,
            split_pdf,
        ])
        .setup(move |app| {
            let url: tauri::Url = format!("http://localhost:{}", LOCALHOST_PORT).parse().unwrap();
            app.add_capability(
                tauri::ipc::CapabilityBuilder::new("localhost")
                    .remote(url.to_string())
                    .window("main"),
            )?;
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(url),
            )
            .title("Paradise PDF")
            .inner_size(600.0, 760.0)
            .min_inner_size(400.0, 400.0)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
