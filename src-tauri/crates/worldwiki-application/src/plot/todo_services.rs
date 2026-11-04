use std::sync::Arc;
use worldwiki_domain::plot::{Todo, TodoStatus};
use worldwiki_ports::repositories::TodoRepository;
use crate::errors::ApplicationError;

pub struct TodoServices {
    pub todo_repo: Arc<dyn TodoRepository>,
}

fn parse_todo_status(status: &str) -> TodoStatus {
    match status {
        "in_progress" => TodoStatus::InProgress,
        "done" => TodoStatus::Done,
        "blocked" => TodoStatus::Blocked,
        _ => TodoStatus::Planned,
    }
}

impl TodoServices {
    pub fn new(todo_repo: Arc<dyn TodoRepository>) -> Self {
        Self { todo_repo }
    }

    async fn get_todo_or_err(&self, todo_id: &str) -> Result<Todo, ApplicationError> {
        self.todo_repo
            .get_by_id(todo_id)
            .await?
            .ok_or_else(|| ApplicationError::NotFound(format!("Todo {todo_id} not found")))
    }

    pub async fn create_todo(&self, owner_id: &str, text: &str, sort_order: i32) -> Result<String, ApplicationError> {
        let todo = Todo::new(owner_id, text, sort_order);
        Ok(self.todo_repo.save(&todo).await?)
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
        Ok(self.todo_repo.save(&todo).await?)
    }

    pub async fn set_todo_status(&self, todo_id: &str, status: &str) -> Result<Todo, ApplicationError> {
        if let Some(updated) = self.todo_repo.set_status(todo_id, status).await? {
            return Ok(updated);
        }
        let mut todo = self.get_todo_or_err(todo_id).await?;
        todo.set_status(parse_todo_status(status));
        self.todo_repo.save(&todo).await?;
        Ok(todo)
    }

    pub async fn auto_start_chapter(&self, chapter_id: &str) -> Result<(), ApplicationError> {
        let todos = self.todo_repo.list_by_owner(chapter_id).await?;
        if let Some(first_planned) = todos.iter().find(|t| t.status == TodoStatus::Planned) {
            self.set_todo_status(&first_planned.id, "in_progress").await?;
        }
        Ok(())
    }

    pub async fn update_todo(&self, todo_id: &str, text: &str) -> Result<(), ApplicationError> {
        let mut todo = self.get_todo_or_err(todo_id).await?;
        todo.text = text.to_string();
        self.todo_repo.save(&todo).await?;
        Ok(())
    }

    pub async fn set_todo_dependency(
        &self,
        todo_id: &str,
        depends_on: Option<String>,
    ) -> Result<Todo, ApplicationError> {
        let mut todo = self.get_todo_or_err(todo_id).await?;
        let clean_dep = depends_on.filter(|s| !s.trim().is_empty());
        todo.depends_on = clean_dep.clone();

        if let Some(ref dep_id) = clean_dep {
            let parent_done = self
                .todo_repo
                .get_by_id(dep_id)
                .await?
                .map(|p| p.is_done || p.status == TodoStatus::Done)
                .unwrap_or(false);
            if !parent_done {
                todo.set_status(TodoStatus::Blocked);
                todo.is_done = false;
            }
        } else if todo.status == TodoStatus::Blocked {
            todo.set_status(TodoStatus::Planned);
        }

        self.todo_repo.save(&todo).await?;
        Ok(todo)
    }

    pub async fn complete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        let mut todo = self.get_todo_or_err(todo_id).await?;
        if !todo.is_done {
            todo.is_done = true;
            self.todo_repo.save(&todo).await?;
        }
        Ok(())
    }

    pub async fn toggle_todo(&self, todo_id: &str) -> Result<Todo, ApplicationError> {
        let mut todo = self.get_todo_or_err(todo_id).await?;
        todo.toggle();
        self.todo_repo.save(&todo).await?;
        Ok(todo)
    }

    pub async fn delete_todo(&self, todo_id: &str) -> Result<(), ApplicationError> {
        self.todo_repo.delete(todo_id).await?;
        Ok(())
    }

    pub async fn list_todos_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, ApplicationError> {
        Ok(self.todo_repo.list_by_owner(owner_id).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockTodoRepo {
        todos: Mutex<Vec<Todo>>,
    }

    #[async_trait]
    impl TodoRepository for MockTodoRepo {
        async fn get_by_id(&self, id: &str) -> Result<Option<Todo>, worldwiki_domain::errors::DomainError> {
            let list = self.todos.lock().unwrap();
            Ok(list.iter().find(|t| t.id == id).cloned())
        }
        async fn save(&self, todo: &Todo) -> Result<String, worldwiki_domain::errors::DomainError> {
            let mut list = self.todos.lock().unwrap();
            if let Some(existing) = list.iter_mut().find(|t| t.id == todo.id) {
                *existing = todo.clone();
                Ok(todo.id.clone())
            } else {
                let id = if todo.id.is_empty() { "todo:1".to_string() } else { todo.id.clone() };
                let mut saved = todo.clone();
                saved.id = id.clone();
                list.push(saved);
                Ok(id)
            }
        }
        async fn set_status(&self, id: &str, status: &str) -> Result<Option<Todo>, worldwiki_domain::errors::DomainError> {
            let mut list = self.todos.lock().unwrap();
            if let Some(t) = list.iter_mut().find(|t| t.id == id) {
                t.set_status(parse_todo_status(status));
                Ok(Some(t.clone()))
            } else {
                Ok(None)
            }
        }
        async fn delete(&self, id: &str) -> Result<(), worldwiki_domain::errors::DomainError> {
            let mut list = self.todos.lock().unwrap();
            list.retain(|t| t.id != id);
            Ok(())
        }
        async fn list_by_owner(&self, owner_id: &str) -> Result<Vec<Todo>, worldwiki_domain::errors::DomainError> {
            let list = self.todos.lock().unwrap();
            Ok(list.iter().filter(|t| t.owner_id == owner_id).cloned().collect())
        }
        async fn list_by_owners(&self, owner_ids: &[&str]) -> Result<Vec<Todo>, worldwiki_domain::errors::DomainError> {
            let list = self.todos.lock().unwrap();
            Ok(list.iter().filter(|t| owner_ids.contains(&t.owner_id.as_str())).cloned().collect())
        }
    }

    #[tokio::test]
    async fn test_set_todo_dependency_blocks_and_unblocks() {
        let repo = Arc::new(MockTodoRepo::default());
        let parent = Todo::new("chapters:c1", "Parent task", 1);
        let parent_id = repo.save(&parent).await.unwrap();

        let child = Todo::new("chapters:c2", "Child task", 1);
        let child_id = repo.save(&child).await.unwrap();

        let service = TodoServices::new(repo);

        let updated = service.set_todo_dependency(&child_id, Some(parent_id.clone())).await.unwrap();
        assert_eq!(updated.status, TodoStatus::Blocked);
        assert_eq!(updated.depends_on, Some(parent_id.clone()));

        let unblocked = service.set_todo_dependency(&child_id, None).await.unwrap();
        assert_eq!(unblocked.status, TodoStatus::Planned);
        assert_eq!(unblocked.depends_on, None);
    }
}
