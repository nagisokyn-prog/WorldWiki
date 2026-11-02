use std::sync::Arc;
use worldwiki_domain::plot::{Todo, TodoStatus};
use worldwiki_ports::repositories::TodoRepository;
use crate::errors::ApplicationError;

pub struct TodoServices {
    pub todo_repo: Arc<dyn TodoRepository>,
}

impl TodoServices {
    pub fn new(todo_repo: Arc<dyn TodoRepository>) -> Self {
        Self { todo_repo }
    }

    pub async fn create_todo(&self, owner_id: &str, text: &str, sort_order: i32) -> Result<String, ApplicationError> {
        let todo = Todo::new(owner_id, text, sort_order);
        let id = self.todo_repo.save(&todo).await?;
        Ok(id)
    }

    pub async fn create_todo_ext(
        &self,
        owner_id: &str,
        text: &str,
        sort_order: i32,
        arc_id: Option<String>,
        depends_on: Option<String>,
    ) -> Result<String, ApplicationError> {
        let mut todo = Todo::new(owner_id, text, sort_order);
        todo.arc_id = arc_id;
        if let Some(dep) = depends_on {
            todo = todo.with_depends_on(dep);
        }
        let id = self.todo_repo.save(&todo).await?;
        Ok(id)
    }

    pub async fn set_todo_status(&self, todo_id: &str, status: &str) -> Result<Todo, ApplicationError> {
        if let Some(updated) = self.todo_repo.set_status(todo_id, status).await? {
            Ok(updated)
        } else if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            let st = match status {
                "in_progress" => TodoStatus::InProgress,
                "done" => TodoStatus::Done,
                "blocked" => TodoStatus::Blocked,
                _ => TodoStatus::Planned,
            };
            todo.set_status(st);
            self.todo_repo.save(&todo).await?;
            Ok(todo)
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn auto_start_chapter(&self, chapter_id: &str) -> Result<(), ApplicationError> {
        let todos = self.todo_repo.list_by_owner(chapter_id).await?;
        for t in todos {
            if t.status == TodoStatus::Planned {
                let _ = self.set_todo_status(&t.id, "in_progress").await;
                break;
            }
        }
        Ok(())
    }

    pub async fn update_todo(&self, todo_id: &str, text: &str) -> Result<(), ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            todo.text = text.to_string();
            self.todo_repo.save(&todo).await?;
            Ok(())
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn complete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            if !todo.is_done {
                todo.is_done = true;
                self.todo_repo.save(&todo).await?;
            }
            Ok(())
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn toggle_todo(&self, todo_id: &str) -> Result<Todo, ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            todo.toggle();
            self.todo_repo.save(&todo).await?;
            Ok(todo)
        } else {
            Err(ApplicationError::NotFound(format!("Todo {todo_id} not found")))
        }
    }

    pub async fn delete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        self.todo_repo.delete(todo_id).await?;
        Ok(())
    }

    pub async fn list_todos_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, ApplicationError> {
        let list = self.todo_repo.list_by_owner(owner_id).await?;
        Ok(list)
    }
}

