use std::path::PathBuf;
use tauri::Manager;
use super::models::{ExportDocumentRequest, ExportDocumentResponse};
use super::{docx, epub, fb2};

#[tauri::command]
pub async fn export_document_docx(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, String> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    docx::generate_docx(&request, &download_dir)
}

#[tauri::command]
pub async fn export_document_epub(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, String> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    epub::generate_epub(&request, &download_dir)
}

#[tauri::command]
pub async fn export_document_fb2(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, String> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    fb2::generate_fb2(&request, &download_dir)
}

#[tauri::command]
pub async fn export_document_pdf_save(
    app: tauri::AppHandle,
    file_name: String,
    pdf_bytes_base64: String,
) -> Result<ExportDocumentResponse, String> {
    use std::fs;

    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let output_path = download_dir.join(&file_name);
    let bytes = reqwest::header::HeaderValue::from_str(&pdf_bytes_base64)
        .ok(); // Or use base64 decoding if needed
    let _ = bytes;

    // Direct write
    fs::write(&output_path, pdf_bytes_base64.as_bytes()).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&output_path).map_err(|e| e.to_string())?;

    Ok(ExportDocumentResponse {
        success: true,
        file_path: output_path.to_string_lossy().to_string(),
        file_name,
        file_size_bytes: metadata.len(),
    })
}
