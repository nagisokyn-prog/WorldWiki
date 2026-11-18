use std::path::PathBuf;
use tauri::Manager;
use worldwiki_domain::document::{ExportDocumentRequest, ExportDocumentResponse};
use worldwiki_infrastructure::documents::{docx, epub, fb2};
use crate::error::IpcError;

fn resolve_download_dir(app: &tauri::AppHandle) -> PathBuf {
    match app.path().download_dir() {
        Ok(dir) => dir,
        Err(_) => PathBuf::from("."),
    }
}

fn fs_ipc_err(e: std::io::Error) -> IpcError {
    IpcError {
        code: "FS_ERROR".to_string(),
        message: e.to_string(),
        details: None,
    }
}

#[tauri::command]
pub async fn export_document_docx(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = resolve_download_dir(&app);
    docx::generate_docx(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_epub(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = resolve_download_dir(&app);
    epub::generate_epub(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_fb2(
    app: tauri::AppHandle,
    request: ExportDocumentRequest,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = resolve_download_dir(&app);
    fb2::generate_fb2(&request, &download_dir).map_err(IpcError::from)
}

#[tauri::command]
pub async fn export_document_pdf_save(
    app: tauri::AppHandle,
    file_name: String,
    pdf_bytes_base64: String,
) -> Result<ExportDocumentResponse, IpcError> {
    let download_dir = resolve_download_dir(&app);

    std::fs::create_dir_all(&download_dir).map_err(fs_ipc_err)?;

    let output_path = download_dir.join(&file_name);

    std::fs::write(&output_path, pdf_bytes_base64.as_bytes()).map_err(fs_ipc_err)?;

    let metadata = std::fs::metadata(&output_path).map_err(fs_ipc_err)?;

    Ok(ExportDocumentResponse {
        success: true,
        file_path: output_path.to_string_lossy().to_string(),
        file_name,
        file_size_bytes: metadata.len(),
    })
}
