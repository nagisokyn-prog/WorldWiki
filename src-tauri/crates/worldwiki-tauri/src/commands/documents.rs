use std::path::PathBuf;
use tauri::Manager;
use worldwiki_domain::document::{ExportDocumentRequest, ExportDocumentResponse};
use worldwiki_infrastructure::documents::{docx, epub, fb2};
use crate::error::IpcError;

#[tauri::command]
pub async fn export_document_docx(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    docx::generate_docx(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_epub(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    epub::generate_epub(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_fb2(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    fb2::generate_fb2(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_pdf_save(
    app: tauri::AppHandle,
    file_name: String,
    pdf_bytes_base64: String,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    std::fs::create_dir_all(&download_dir)
        .map_err(|e| IpcError {
            code: "FS_ERROR".to_string(),
            message: e.to_string(),
            details: None,
        })?;

    let output_path = download_dir.join(&file_name);

    std::fs::write(&output_path, pdf_bytes_base64.as_bytes())
        .map_err(|e| IpcError {
            code: "FS_ERROR".to_string(),
            message: e.to_string(),
            details: None,
        })?;

    let metadata = std::fs::metadata(&output_path)
        .map_err(|e| IpcError {
            code: "FS_ERROR".to_string(),
            message: e.to_string(),
            details: None,
        })?;

    Ok(ExportDocumentResponse {
        success: true,
        file_path: output_path.to_string_lossy().to_string(),
        file_name,
        file_size_bytes: metadata.len(),
    })
}
