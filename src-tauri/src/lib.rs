use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tauri::Manager;
mod encryption;

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", ".git", ".tools", ".vs"];

#[derive(Serialize)]
struct TreeNode {
    name: String,
    kind: String,
    path: String,
    children: Vec<TreeNode>,
    open: bool,
}

#[derive(Serialize)]
struct CreatedFile {
    path: String,
    name: String,
}

fn is_markdown(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")
}

fn list_dir(path: &Path, depth: usize) -> Vec<TreeNode> {
    if depth > 6 {
        return Vec::new();
    }
    let entries = match std::fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let child_path = entry.path();
        if file_type.is_dir() {
            let children = list_dir(&child_path, depth + 1);
            if children.is_empty() {
                continue;
            }
            nodes.push(TreeNode {
                name,
                kind: "dir".into(),
                path: child_path.display().to_string(),
                children,
                open: depth < 1,
            });
        } else if file_type.is_file() && is_markdown(&name) {
            nodes.push(TreeNode {
                name,
                kind: "file".into(),
                path: child_path.display().to_string(),
                children: Vec::new(),
                open: false,
            });
        }
    }
    nodes.sort_by(|a, b| {
        let rank = |kind: &str| if kind == "dir" { 0 } else { 1 };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    nodes
}

fn decode_text(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(&bytes[3..]).into_owned();
    }
    match String::from_utf8(bytes.to_vec()) {
        Ok(text) => text,
        Err(_) => encoding_rs::GBK.decode(bytes).0.into_owned(),
    }
}

#[tauri::command]
fn pick_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("打开文件夹")
        .pick_folder()
        .map(|path| path.display().to_string())
}

#[tauri::command]
async fn list_workspace(path: String) -> Result<Vec<TreeNode>, String> {
    tauri::async_runtime::spawn_blocking(move || list_dir(Path::new(&path), 0))
        .await
        .map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentContents {
    text: String,
    key_id: String,
}

fn read_document_bytes(bytes: &[u8]) -> Result<DocumentContents, String> {
    if let Some((text, key_id)) = encryption::decrypt_if_needed(bytes)? {
        Ok(DocumentContents { text, key_id })
    } else {
        Ok(DocumentContents { text: decode_text(bytes), key_id: String::new() })
    }
}

#[tauri::command]
async fn read_text(path: String) -> Result<DocumentContents, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
        read_document_bytes(&bytes)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn markdown_link_path(source: &Path, target: &str) -> Result<CreatedFile, String> {
    let relative = Path::new(target);
    let invalid = || "此链接必须指向本地 Markdown 或文本文件".to_string();
    if target.chars().any(|c| c.is_control() || c == ':')
        || !relative.components().all(|part| matches!(
            part, std::path::Component::Normal(_) | std::path::Component::CurDir | std::path::Component::ParentDir
        ))
        || !relative.file_name().and_then(|name| name.to_str()).is_some_and(is_markdown)
    {
        return Err(invalid());
    }
    let parent = source.parent().filter(|_| source.is_absolute())
        .ok_or_else(|| "请先保存当前文档".to_string())?;
    let path = parent.join(relative).canonicalize()
        .map_err(|error| format!("无法打开链接文件 {target}：{error}"))?;
    let name = path.file_name().and_then(|name| name.to_str())
        .filter(|name| is_markdown(name)).ok_or_else(invalid)?.to_owned();
    if !path.is_file() {
        return Err(invalid());
    }
    let path = path.display().to_string();
    // Match the ordinary Windows paths used by the workspace tree and tab list.
    #[cfg(windows)]
    let path = if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(&path).to_owned()
    };
    Ok(CreatedFile { path, name })
}

#[tauri::command]
async fn resolve_markdown_link(source: String, target: String) -> Result<CreatedFile, String> {
    tauri::async_runtime::spawn_blocking(move || markdown_link_path(Path::new(&source), &target))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn write_text(path: String, contents: String, encryption_key_id: Option<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        encryption::write_document(Path::new(&path), &contents, encryption_key_id.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn list_encryption_keys() -> Result<Vec<encryption::KeySummary>, String> {
    tauri::async_runtime::spawn_blocking(encryption::list_keys).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn add_encryption_key(name: String, secret: String) -> Result<encryption::KeySummary, String> {
    tauri::async_runtime::spawn_blocking(move || encryption::add_key(name, secret)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn remove_encryption_key(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || encryption::remove_key(&id)).await.map_err(|e| e.to_string())?
}

#[derive(Serialize)]
struct SearchHit {
    path: String,
    name: String,
    line: usize,
    text: String,
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    fn value(byte: u8) -> Result<u8, String> {
        match byte {
            b'A'..=b'Z' => Ok(byte - b'A'),
            b'a'..=b'z' => Ok(byte - b'a' + 26),
            b'0'..=b'9' => Ok(byte - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            _ => Err("图片数据无效".into()),
        }
    }
    let bytes = input.trim().as_bytes();
    let mut out = Vec::new();
    let mut index = 0;
    while index + 1 < bytes.len() {
        if bytes[index] == b'=' {
            break;
        }
        let first = value(bytes[index])?;
        let second = value(bytes[index + 1])?;
        let third = *bytes.get(index + 2).unwrap_or(&b'=');
        let fourth = *bytes.get(index + 3).unwrap_or(&b'=');
        out.push((first << 2) | (second >> 4));
        if third != b'=' {
            out.push((second << 4) | (value(third)? >> 2));
        }
        if fourth != b'=' {
            out.push((value(third)? << 6) | value(fourth)?);
        }
        index += 4;
    }
    Ok(out)
}

fn file_name_only(name: &str) -> Result<String, String> {
    Path::new(name)
        .file_name()
        .map(|item| item.to_string_lossy().into_owned())
        .filter(|item| !item.is_empty() && item != "." && item != "..")
        .ok_or_else(|| "无效的名称".into())
}

#[tauri::command]
fn set_window_theme(window: tauri::WebviewWindow, theme: String) -> Result<(), String> {
    let mode = if theme == "dark" {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    };
    window.set_theme(Some(mode)).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_file(name: String, extension: String) -> Option<String> {
    let dialog = rfd::FileDialog::new()
        .set_file_name(&name)
        .add_filter(&extension, &[&extension]);
    dialog.save_file().map(|path| {
        let text = path.display().to_string();
        let suffix = format!(".{extension}");
        if extension.is_empty() || text.to_ascii_lowercase().ends_with(&suffix) {
            text
        } else {
            text + &suffix
        }
    })
}

#[tauri::command]
fn write_base64(path: String, data: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let bytes = decode_base64(&data)?;
    std::fs::write(&path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_path(from: String, to_name: String) -> Result<String, String> {
    let source = PathBuf::from(&from);
    let parent = source.parent().ok_or("无法重命名")?;
    let target = parent.join(file_name_only(&to_name)?);
    std::fs::rename(&source, &target).map_err(|error| error.to_string())?;
    Ok(target.display().to_string())
}

#[tauri::command]
fn remove_path(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Ok(());
    }
    let metadata = std::fs::metadata(&target).map_err(|error| format!("{error}：{path}"))?;
    let mut permissions = metadata.permissions();
    if permissions.readonly() {
        permissions.set_readonly(false);
        let _ = std::fs::set_permissions(&target, permissions);
    }
    let result = if metadata.is_dir() {
        std::fs::remove_dir_all(&target)
    } else {
        std::fs::remove_file(&target)
    };
    result.map_err(|error| format!("{error}：{path}"))
}

#[tauri::command]
fn create_folder(dir: String, name: String) -> Result<String, String> {
    let path = PathBuf::from(dir).join(file_name_only(&name)?);
    std::fs::create_dir(&path).map_err(|error| error.to_string())?;
    Ok(path.display().to_string())
}

fn search_dir(path: &Path, needle: &str, hits: &mut Vec<SearchHit>, depth: usize) {
    if depth > 8 || hits.len() >= 40 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        if hits.len() >= 40 {
            return;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.')
            || SKIP_DIRS.contains(&name.as_str())
            || matches!(name.as_str(), "venv" | ".venv" | "__pycache__" | "site-packages")
        {
            continue;
        }
        let child = entry.path();
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            search_dir(&child, needle, hits, depth + 1);
            continue;
        }
        if !kind.is_file() || !is_markdown(&name) {
            continue;
        }
        let Ok(bytes) = std::fs::read(&child) else {
            continue;
        };
        if bytes.len() > 1_000_000 {
            continue;
        }
        let Ok(document) = read_document_bytes(&bytes) else { continue; };
        let text = document.text;
        for (index, line) in text.lines().enumerate() {
            if hits.len() >= 40 {
                return;
            }
            if line.to_lowercase().contains(needle) {
                hits.push(SearchHit {
                    path: child.display().to_string(),
                    name: name.clone(),
                    line: index + 1,
                    text: line.trim().chars().take(80).collect(),
                });
            }
        }
    }
}

#[tauri::command]
async fn search_workspace(path: String, query: String) -> Result<Vec<SearchHit>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let needle = query.trim().to_lowercase();
        let mut hits = Vec::new();
        if !needle.is_empty() { search_dir(Path::new(&path), &needle, &mut hits, 0); }
        hits
    }).await.map_err(|error| error.to_string())
}

fn find_edge() -> Option<PathBuf> {
    let candidates = [
        std::env::var("PROGRAMFILES").ok().map(|root| {
            PathBuf::from(root).join("Microsoft\\Edge\\Application\\msedge.exe")
        }),
        std::env::var("PROGRAMFILES(X86)").ok().map(|root| {
            PathBuf::from(root).join("Microsoft\\Edge\\Application\\msedge.exe")
        }),
        Some(PathBuf::from(
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        )),
        Some(PathBuf::from(
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        )),
    ];
    candidates
        .into_iter()
        .flatten()
        .find(|path| path.is_file())
}

#[tauri::command]
async fn file_stamp(path: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let modified = std::fs::metadata(&path)
            .and_then(|meta| meta.modified())
            .map_err(|error| error.to_string())?;
        Ok(modified
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_secs())
            .unwrap_or(0))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn docx_paragraph(text: &str, size: u32, bold: bool) -> String {
    let bold_tag = if bold { "<w:b/>" } else { "" };
    format!(
        "<w:p><w:r><w:rPr>{bold_tag}<w:sz w:val=\"{size}\"/></w:rPr><w:t xml:space=\"preserve\">{}</w:t></w:r></w:p>",
        xml_escape(text)
    )
}

fn is_table_sep(line: &str) -> bool {
    let trimmed = line.trim();
    !trimmed.is_empty()
        && trimmed.contains('|')
        && trimmed
            .chars()
            .all(|ch| matches!(ch, '|' | '-' | ':' | ' ' | '\t'))
}

fn split_md_row(line: &str) -> Vec<String> {
    let mut text = line.trim();
    if text.starts_with('|') {
        text = &text[1..];
    }
    if text.ends_with('|') {
        text = &text[..text.len().saturating_sub(1)];
    }
    text.split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}

fn docx_table(rows: &[Vec<String>]) -> String {
    let mut out = String::from(
        "<w:tbl><w:tblPr><w:tblW w:w=\"5000\" w:type=\"pct\"/><w:tblBorders>\
<w:top w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:left w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:right w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
</w:tblBorders></w:tblPr>",
    );
    for (row_index, row) in rows.iter().enumerate() {
        out.push_str("<w:tr>");
        for cell in row {
            let bold = row_index == 0;
            out.push_str("<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>");
            out.push_str(&docx_paragraph(cell, 20, bold));
            out.push_str("</w:tc>");
        }
        out.push_str("</w:tr>");
    }
    out.push_str("</w:tbl>");
    out.push_str(&docx_paragraph("", 20, false));
    out
}

fn image_ext(path: &str) -> Option<&'static str> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".png") || lower.contains("image/png") {
        Some("png")
    } else if lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.contains("image/jpeg")
        || lower.contains("image/jpg")
    {
        Some("jpeg")
    } else if lower.ends_with(".gif") || lower.contains("image/gif") {
        Some("gif")
    } else if lower.ends_with(".webp") || lower.contains("image/webp") {
        Some("webp")
    } else {
        None
    }
}

fn decode_data_image(src: &str) -> Option<(String, Vec<u8>)> {
    let rest = src.strip_prefix("data:")?;
    let (meta, data) = rest.split_once(',')?;
    if !meta.contains(";base64") {
        return None;
    }
    let ext = image_ext(meta)?.to_string();
    let bytes = decode_base64(data).ok()?;
    Some((ext, bytes))
}

fn download_url_bytes(url: &str) -> Option<Vec<u8>> {
    let tag: u32 = url.bytes().fold(0u32, |acc, b| acc.wrapping_mul(31).wrapping_add(u32::from(b)));
    let temp = std::env::temp_dir().join(format!("tolcy-img-{}-{tag}", std::process::id()));
    let status = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "try {{ Invoke-WebRequest -UseBasicParsing -Uri '{}' -OutFile '{}' -TimeoutSec 20 }} catch {{ exit 1 }}",
                url.replace('\'', "''"),
                temp.display()
            ),
        ])
        .status()
        .ok()?;
    if !status.success() {
        let _ = std::fs::remove_file(&temp);
        return None;
    }
    let bytes = std::fs::read(&temp).ok();
    let _ = std::fs::remove_file(&temp);
    bytes
}

struct DocxBuild {
    document: String,
    rels: String,
    files: Vec<(String, Vec<u8>)>,
    content_types_extra: String,
}

fn markdown_to_docx(markdown: &str, base_dir: &Path) -> DocxBuild {
    let mut body = String::new();
    let mut rels = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">",
    );
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut content_types_extra = String::new();
    let mut image_id = 0usize;
    let mut in_code = false;
    let lines: Vec<&str> = markdown.lines().collect();
    let mut index = 0usize;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with("```") {
            in_code = !in_code;
            index += 1;
            continue;
        }
        if in_code {
            body.push_str(&docx_paragraph(line, 20, false));
            index += 1;
            continue;
        }
        if line.contains('|') && index + 1 < lines.len() && is_table_sep(lines[index + 1]) {
            let mut rows = Vec::new();
            while index < lines.len() && lines[index].contains('|') {
                if !is_table_sep(lines[index]) {
                    rows.push(split_md_row(lines[index]));
                }
                index += 1;
            }
            if !rows.is_empty() {
                body.push_str(&docx_table(&rows));
            }
            continue;
        }
        let trimmed = line.trim();
        if trimmed.starts_with("![") && trimmed.contains("](") && trimmed.ends_with(')') {
            let mid = trimmed.find("](").unwrap_or(0);
            let alt = trimmed.get(2..mid).unwrap_or("").to_string();
            let src = trimmed.get(mid + 2..trimmed.len() - 1).unwrap_or("").to_string();
            let resolved = if src.starts_with("data:") {
                decode_data_image(&src)
            } else if src.starts_with("http://") || src.starts_with("https://") {
                let ext = image_ext(&src).unwrap_or("png").to_string();
                download_url_bytes(&src).map(|bytes| (ext, bytes))
            } else if let Some(ext) = image_ext(&src) {
                let path = if Path::new(&src).is_absolute() {
                    PathBuf::from(&src)
                } else {
                    base_dir.join(&src)
                };
                std::fs::read(&path)
                    .ok()
                    .map(|bytes| (ext.to_string(), bytes))
            } else {
                None
            };
            if let Some((ext, bytes)) = resolved {
                image_id += 1;
                let rid = format!("rIdImg{image_id}");
                let part = format!("media/image{image_id}.{ext}");
                let content_type = match ext.as_str() {
                    "png" => "image/png",
                    "jpeg" => "image/jpeg",
                    "gif" => "image/gif",
                    _ => "image/webp",
                };
                if !content_types_extra.contains(&format!("Extension=\"{ext}\"")) {
                    content_types_extra.push_str(&format!(
                        "<Default Extension=\"{ext}\" ContentType=\"{content_type}\"/>"
                    ));
                }
                rels.push_str(&format!(
                    "<Relationship Id=\"{rid}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"{part}\"/>"
                ));
                files.push((format!("word/{part}"), bytes));
                let cx = 4000000i64;
                let cy = 3000000i64;
                let safe_alt = xml_escape(&alt);
                body.push_str(&format!(
                    "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">\
<wp:extent cx=\"{cx}\" cy=\"{cy}\"/><wp:docPr id=\"{image_id}\" name=\"{safe_alt}\"/>\
<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">\
<pic:pic><pic:nvPicPr><pic:cNvPr id=\"0\" name=\"{safe_alt}\"/><pic:cNvPicPr/></pic:nvPicPr>\
<pic:blipFill><a:blip r:embed=\"{rid}\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>\
<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{cx}\" cy=\"{cy}\"/></a:xfrm>\
<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>\
</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>"
                ));
                index += 1;
                continue;
            }
            body.push_str(&docx_paragraph(&format!("[{alt}]({src})"), 22, false));
            index += 1;
            continue;
        }
        if let Some(text) = line.strip_prefix("### ") {
            body.push_str(&docx_paragraph(text, 28, true));
        } else if let Some(text) = line.strip_prefix("## ") {
            body.push_str(&docx_paragraph(text, 32, true));
        } else if let Some(text) = line.strip_prefix("# ") {
            body.push_str(&docx_paragraph(text, 40, true));
        } else {
            body.push_str(&docx_paragraph(line, 22, false));
        }
        index += 1;
    }
    rels.push_str("</Relationships>");
    let document = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" \
xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">\
<w:body>{body}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/></w:sectPr></w:body></w:document>"
    );
    DocxBuild {
        document,
        rels,
        files,
        content_types_extra,
    }
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in data {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

fn zip_stored(files: &[(&str, &[u8])]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut central = Vec::new();
    for (index, (name, data)) in files.iter().enumerate() {
        let name_bytes = name.as_bytes();
        let crc = crc32(data);
        let offset = out.len() as u32;
        out.extend_from_slice(&0x04034b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(data);
        central.extend_from_slice(&0x02014b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&crc.to_le_bytes());
        central.extend_from_slice(&(data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name_bytes);
        let _ = index;
    }
    let central_start = out.len() as u32;
    out.extend_from_slice(&central);
    out.extend_from_slice(&0x06054b50u32.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&(files.len() as u16).to_le_bytes());
    out.extend_from_slice(&(files.len() as u16).to_le_bytes());
    out.extend_from_slice(&(central.len() as u32).to_le_bytes());
    out.extend_from_slice(&central_start.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out
}

#[tauri::command]
fn export_docx(markdown: String, path: String, base_dir: String) -> Result<(), String> {
    let base = if base_dir.trim().is_empty() {
        PathBuf::from(".")
    } else {
        PathBuf::from(&base_dir)
    };
    let built = markdown_to_docx(&markdown, &base);
    let content_types = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
{}<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>\
</Types>",
        built.content_types_extra
    );
    let rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>\
</Relationships>";
    let mut entries: Vec<(String, Vec<u8>)> = vec![
        ("[Content_Types].xml".into(), content_types.into_bytes()),
        ("_rels/.rels".into(), rels.as_bytes().to_vec()),
        (
            "word/_rels/document.xml.rels".into(),
            built.rels.into_bytes(),
        ),
        ("word/document.xml".into(), built.document.into_bytes()),
    ];
    entries.extend(built.files);
    let owned: Vec<(String, Vec<u8>)> = entries;
    let refs: Vec<(&str, &[u8])> = owned
        .iter()
        .map(|(name, data)| (name.as_str(), data.as_slice()))
        .collect();
    let bytes = zip_stored(&refs);
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_epub(title: String, html: String, css: String, path: String) -> Result<(), String> {
    let safe_title = xml_escape(&title);
    let mimetype = b"application/epub+zip".as_slice();
    let container = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\
<rootfiles><rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles>\
</container>";
    let opf = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<package xmlns=\"http://www.idpf.org/2007/opf\" unique-identifier=\"bookid\" version=\"2.0\">\
<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\
<dc:title>{safe_title}</dc:title><dc:language>zh</dc:language>\
<dc:identifier id=\"bookid\">tolcy-{safe_title}</dc:identifier>\
</metadata>\
<manifest>\
<item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\"/>\
<item id=\"chap1\" href=\"chapter.xhtml\" media-type=\"application/xhtml+xml\"/>\
<item id=\"style\" href=\"style.css\" media-type=\"text/css\"/>\
</manifest>\
<spine toc=\"ncx\"><itemref idref=\"chap1\"/></spine>\
</package>"
    );
    let ncx = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">\
<head><meta name=\"dtb:uid\" content=\"tolcy-{safe_title}\"/></head>\
<docTitle><text>{safe_title}</text></docTitle>\
<navMap><navPoint id=\"nav1\" playOrder=\"1\"><navLabel><text>{safe_title}</text></navLabel>\
<content src=\"chapter.xhtml\"/></navPoint></navMap></ncx>"
    );
    let base_css = "body{font-family:Georgia,\"Times New Roman\",serif;line-height:1.7;color:#222;margin:1.2em}\
img,svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px}\
pre,code{font-family:Consolas,monospace}pre{background:#f6f8fa;padding:12px;overflow:auto}\
.katex,.language-math{font-size:1.05em}.language-mermaid,.vditor-mermaid{text-align:center;overflow:auto;margin:1em 0}";
    let style = format!("{base_css}\n{css}");
    let chapter = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<!DOCTYPE html>\
<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>{safe_title}</title>\
<link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\"/>\
</head><body>{html}</body></html>"
    );
    let bytes = zip_stored(&[
        ("mimetype", mimetype),
        ("META-INF/container.xml", container.as_bytes()),
        ("OEBPS/content.opf", opf.as_bytes()),
        ("OEBPS/toc.ncx", ncx.as_bytes()),
        ("OEBPS/style.css", style.as_bytes()),
        ("OEBPS/chapter.xhtml", chapter.as_bytes()),
    ]);
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn export_pdf(html: String, path: String) -> Result<(), String> {
    let edge = find_edge().ok_or("没有找到 Microsoft Edge，无法直接保存 PDF")?;
    let temp_dir = std::env::temp_dir().join(format!("tolcy-pdf-{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let html_path = temp_dir.join("page.html");
    std::fs::write(&html_path, html).map_err(|error| error.to_string())?;
    let profile = temp_dir.join("profile");
    let status = std::process::Command::new(edge)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-pdf-header-footer",
            &format!("--user-data-dir={}", profile.display()),
            &format!("--print-to-pdf={}", path),
            &html_path.display().to_string(),
        ])
        .status()
        .map_err(|error| error.to_string())?;
    let pdf = Path::new(&path);
    for _ in 0..100 {
        if pdf.is_file() {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    let _ = std::fs::remove_dir_all(&temp_dir);
    if status.success() {
        Err("没有生成 PDF 文件".into())
    } else {
        Err("导出 PDF 失败".into())
    }
}

#[tauri::command]
fn create_markdown(dir: String) -> Result<CreatedFile, String> {
    let directory = PathBuf::from(&dir);
    let mut index = 2;
    let mut name = "未命名.md".to_string();
    loop {
        let path = directory.join(&name);
        if !path.exists() {
            std::fs::write(&path, "").map_err(|error| error.to_string())?;
            return Ok(CreatedFile {
                path: path.display().to_string(),
                name,
            });
        }
        name = format!("未命名-{index}.md");
        index += 1;
        if index > 100 {
            return Err("无法新建文件".into());
        }
    }
}

static ALLOW_CLOSE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn finish_close(window: tauri::WebviewWindow) {
    ALLOW_CLOSE.store(true, Ordering::SeqCst);
    let _ = window.destroy();
}

fn launch_paths(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-') && is_markdown(arg))
        .map(|arg| cwd.join(arg).to_string_lossy().into_owned())
        .collect()
}

#[derive(Default)]
struct LaunchFiles(Mutex<Vec<String>>);

#[tauri::command]
fn launch_args(files: tauri::State<'_, LaunchFiles>) -> Result<Vec<String>, String> {
    let mut pending = files.0.lock().map_err(|error| error.to_string())?;
    Ok(std::mem::take(&mut *pending))
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("路径不存在：{path}"));
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let display = target
            .canonicalize()
            .unwrap_or(target)
            .to_string_lossy()
            .trim_start_matches(r"\\?\")
            .replace('/', "\\");
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{display}\""))
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = if target.is_dir() {
            target.clone()
        } else {
            target
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or(target)
        };
        std::process::Command::new("xdg-open")
            .arg(dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("当前平台不支持在文件夹中显示".into())
}

fn external_url(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.chars().any(char::is_control) {
        return Err("无效的链接".into());
    }
    let parsed = url::Url::parse(value).map_err(|_| "无效的链接".to_string())?;
    match parsed.scheme() {
        "http" | "https" if parsed.host_str().is_some() => Ok(parsed.to_string()),
        "mailto" if !parsed.path().is_empty() => Ok(parsed.to_string()),
        _ => Err("仅支持网页或邮件链接".into()),
    }
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    let target = external_url(&url)?;
    tauri::async_runtime::spawn_blocking(move || open::that(target).map_err(|error| error.to_string()))
        .await
        .map_err(|error| error.to_string())?
}

pub fn run() {
    let context = tauri::generate_context!();
    #[cfg(windows)]
    {
        // Use the same taskbar identity as the installer's shortcuts.
        let app_id: Vec<u16> = context.config().identifier.encode_utf16().chain([0]).collect();
        unsafe { windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr()); }
    }
    let cwd = std::env::current_dir().unwrap_or_default();
    let builder = tauri::Builder::default()
        .manage(LaunchFiles(Mutex::new(launch_paths(std::env::args(), &cwd))));
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        let paths = launch_paths(args, Path::new(&cwd));
        if !paths.is_empty() {
            if let Ok(mut pending) = app.state::<LaunchFiles>().0.lock() {
                pending.extend(paths);
            }
            let _ = app.emit("launch-files", ());
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));
    builder
        .setup(|app| {
            encryption::initialize(app.path().app_data_dir()?)
                .map_err(std::io::Error::other)?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_theme(Some(tauri::Theme::Light));
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if ALLOW_CLOSE.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                let _ = window.emit("app-close", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            list_workspace,
            read_text,
            resolve_markdown_link,
            write_text,
            list_encryption_keys,
            add_encryption_key,
            remove_encryption_key,
            create_markdown,
            set_window_theme,
            save_file,
            write_base64,
            rename_path,
            remove_path,
            create_folder,
            search_workspace,
            export_pdf,
            export_docx,
            export_epub,
            file_stamp,
            finish_close,
            launch_args,
            reveal_in_folder,
            open_external_url
        ])
        .run(context)
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_links_resolve_from_the_source_document() {
        let dir = std::env::temp_dir().join(format!("tolcy-link-test-{}", std::process::id()));
        let folder = dir.join("week");
        std::fs::create_dir_all(&folder).unwrap();
        let source = folder.join("index.md");
        let target = folder.join("04_周四_治理与业务编码.md");
        std::fs::write(&source, "contents").unwrap();
        std::fs::write(&target, "linked contents").unwrap();
        let linked = markdown_link_path(&source, "./04_周四_治理与业务编码.md").unwrap();
        assert_eq!(linked.name, "04_周四_治理与业务编码.md");
        assert_eq!(std::fs::read_to_string(linked.path).unwrap(), "linked contents");
        std::fs::write(dir.join("overview.md"), "overview").unwrap();
        assert!(markdown_link_path(&source, "../overview.md").is_ok());
        for invalid in ["missing.md", "notepad.exe", "//example.test/share.md", "C:other.md", "note.md\0"] {
            assert!(markdown_link_path(&source, invalid).is_err(), "{invalid}");
        }
        assert!(markdown_link_path(&source, &target.to_string_lossy()).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn external_links_only_allow_web_and_mail_targets() {
        assert_eq!(external_url("https://example.com/a?q=1#part").unwrap(), "https://example.com/a?q=1#part");
        assert!(external_url(" http://localhost:4173/ ").is_ok());
        assert!(external_url("mailto:hello@example.com?subject=Hello").is_ok());
        for target in ["javascript:alert(1)", "file:///C:/Windows/notepad.exe", "data:text/html,test", "ms-settings:about", "../notes.md", "https://exa\nmple.com", "mailto:"] {
            assert!(external_url(target).is_err(), "Unexpected allowed URL: {target}");
        }
    }

    #[test]
    fn filesystem_commands_handle_a_removed_file_and_recover_to_a_new_location() {
        let dir = std::env::temp_dir().join(format!("tolcy-device-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let original = dir.join("usb.md").display().to_string();
        tauri::async_runtime::block_on(write_text(original.clone(), "cached text".into(), None)).unwrap();
        assert_eq!(tauri::async_runtime::block_on(read_text(original.clone())).unwrap().text, "cached text");
        assert!(tauri::async_runtime::block_on(file_stamp(original.clone())).is_ok());
        std::fs::remove_file(&original).unwrap();
        assert!(tauri::async_runtime::block_on(read_text(original.clone())).is_err());
        assert!(tauri::async_runtime::block_on(file_stamp(original)).is_err());
        assert!(tauri::async_runtime::block_on(write_text(dir.display().to_string(), "text".into(), None)).is_err());
        let recovered = dir.join("local.md").display().to_string();
        tauri::async_runtime::block_on(write_text(recovered.clone(), "cached text".into(), None)).unwrap();
        assert_eq!(tauri::async_runtime::block_on(read_text(recovered)).unwrap().text, "cached text");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn lists_nested_markdown_and_skips_other_files() {
        let dir = std::env::temp_dir().join(format!("tolcy-tree-{}", std::process::id()));
        let notes = dir.join("笔记");
        std::fs::create_dir_all(&notes).unwrap();
        std::fs::write(notes.join("今天.md"), "# 今天").unwrap();
        std::fs::write(dir.join("图片.png"), "nope").unwrap();
        std::fs::create_dir_all(dir.join("node_modules")).unwrap();
        std::fs::write(dir.join("node_modules").join("skip.md"), "# skip").unwrap();

        let tree = list_dir(&dir, 0);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].name, "笔记");
        assert_eq!(tree[0].children.len(), 1);
        assert_eq!(tree[0].children[0].name, "今天.md");
        assert!(tree[0].children[0].path.ends_with("今天.md"));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
