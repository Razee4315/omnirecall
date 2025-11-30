use serde::{Deserialize, Serialize};
use crate::error::Result;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: String,
    pub color: String,
    pub document_count: u32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSpaceRequest {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[tauri::command]
pub async fn create_space(request: CreateSpaceRequest) -> Result<Space> {
    let now = chrono::Utc::now().to_rfc3339();
    let icon = request.icon.unwrap_or_else(|| {
        request.name.chars().next().unwrap_or('S').to_uppercase().to_string()
    });

    let space = Space {
        id: Uuid::new_v4().to_string(),
        name: request.name,
        description: request.description,
        icon,
        color: request.color.unwrap_or_else(|| "#4a9eff".to_string()),
        document_count: 0,
        created_at: now.clone(),
        updated_at: now,
    };

    // In a real implementation, we would save to database
    Ok(space)
}

#[tauri::command]
pub async fn list_spaces() -> Result<Vec<Space>> {
    // Return mock data including default space
    let now = chrono::Utc::now().to_rfc3339();
    
    Ok(vec![
        Space {
            id: "default".to_string(),
            name: "Quick Notes".to_string(),
            description: Some("Default space for quick queries".to_string()),
            icon: "N".to_string(),
            color: "#4a9eff".to_string(),
            document_count: 0,
            created_at: now.clone(),
            updated_at: now,
        },
    ])
}

#[tauri::command]
pub async fn delete_space(space_id: String) -> Result<()> {
    if space_id == "default" {
        return Err(crate::error::AppError::Config(
            "Cannot delete default space".to_string(),
        ));
    }
    
    tracing::info!("Deleting space: {}", space_id);
    // In a real implementation, we would:
    // 1. Delete all documents in space
    // 2. Delete all conversations in space
    // 3. Delete space from database
    Ok(())
}
