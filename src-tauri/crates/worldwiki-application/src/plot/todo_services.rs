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

    pub async fn set_todo_dependency(
        &self,
        todo_id: &str,
        depends_on: Option<String>,
    ) -> Result<Todo, ApplicationError> {
        if let Some(mut todo) = self.todo_repo.get_by_id(todo_id).await? {
            let clean_dep = depends_on.filter(|s| !s.trim().is_empty());
            todo.depends_on = clean_dep.clone();
            if let Some(ref dep_id) = clean_dep {
                if let Some(parent) = self.todo_repo.get_by_id(dep_id).await? {
                    if !parent.is_done && parent.status != TodoStatus::Done {
                        todo.set_status(TodoStatus::Blocked);
                        todo.is_done = false;
                    }
                } else {
                    todo.set_status(TodoStatus::Blocked);
                    todo.is_done = false;
                }
            } else if todo.status == TodoStatus::Blocked {
                todo.set_status(TodoStatus::Planned);
            }
            self.todo_repo.save(&todo).await?;
            Ok(todo)
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
            if let Some(pos) = list.iter().position(|t| t.id == todo.id) {
                list[pos] = todo.clone();
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
                let st = match status {
                    "in_progress" => TodoStatus::InProgress,
                    "done" => TodoStatus::Done,
                    "blocked" => TodoStatus::Blocked,
                    _ => TodoStatus::Planned,
                };
                t.set_status(st);
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

