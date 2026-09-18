use std::fs;
use std::path::PathBuf;

const CERBERUS_TEMPLATE_MD: &str = include_str!("templates/CERBERUS.template.md");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProjectScope {
    Fullstack,
    BackendOnly,
    FrontendOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScaffoldOptions {
    pub target_dir: PathBuf,
    pub scope: ProjectScope,
    pub adopt_existing: bool,
    pub force: bool,
}

impl ScaffoldOptions {
    pub fn new(target_dir: impl Into<PathBuf>, scope: ProjectScope) -> Self {
        Self {
            target_dir: target_dir.into(),
            scope,
            adopt_existing: false,
            force: false,
        }
    }

    pub fn with_adopt(mut self, adopt: bool) -> Self {
        self.adopt_existing = adopt;
        self
    }

    pub fn with_force(mut self, force: bool) -> Self {
        self.force = force;
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScaffoldReport {
    pub created_files: Vec<String>,
    pub scope: ProjectScope,
    pub adopted_violations_count: usize,
    pub message: String,
}

pub struct ScaffoldUseCase;

impl ScaffoldUseCase {
    pub fn execute(options: &ScaffoldOptions) -> Result<ScaffoldReport, String> {
        let root = &options.target_dir;
        if !root.exists() {
            if let Err(e) = fs::create_dir_all(root) {
                return Err(format!("Failed to create directory '{}': {}", root.display(), e));
            }
        }

        let mut created_files = Vec::new();

        // 1. Write cerberus.json
        let config_path = root.join("cerberus.json");
        if !config_path.exists() || options.force {
            let config_content = Self::generate_config(options.scope);
            if let Err(e) = fs::write(&config_path, &config_content) {
                return Err(format!("Failed to write '{}': {}", config_path.display(), e));
            }
            created_files.push(config_path.file_name().unwrap().to_string_lossy().to_string());
        }

        // 2. Write CERBERUS.md
        let md_path = root.join("CERBERUS.md");
        if !md_path.exists() || options.force {
            if let Err(e) = fs::write(&md_path, CERBERUS_TEMPLATE_MD) {
                return Err(format!("Failed to write '{}': {}", md_path.display(), e));
            }
            created_files.push(md_path.file_name().unwrap().to_string_lossy().to_string());
        }

        // 3. Handle --adopt / baseline capture
        let mut adopted_count = 0;
        if options.adopt_existing {
            let baseline_path = root.join("cerberus-baseline.json");
            if !baseline_path.exists() || options.force {
                let initial_baseline = "[\n]\n";
                if let Err(e) = fs::write(&baseline_path, initial_baseline) {
                    return Err(format!("Failed to write baseline: {}", e));
                }
                created_files.push(baseline_path.file_name().unwrap().to_string_lossy().to_string());
            }
            adopted_count = 0;
        }

        let message = if created_files.is_empty() {
            format!(
                "Cerberus is already initialized in '{}'. Use --force to overwrite existing files.",
                root.display()
            )
        } else {
            format!(
                "Successfully initialized Cerberus ({:?}) in '{}'. Created: {}",
                options.scope,
                root.display(),
                created_files.join(", ")
            )
        };

        Ok(ScaffoldReport {
            created_files,
            scope: options.scope,
            adopted_violations_count: adopted_count,
            message,
        })
    }

    pub fn generate_config(scope: ProjectScope) -> String {
        match scope {
            ProjectScope::Fullstack => serde_json::json!({
                "$schema": "./schema/cerberus.schema.json",
                "backend": {
                    "layers": {
                        "domain": {
                            "allowed_deps": [],
                            "forbidden_external": ["reqwest", "tokio", "tauri", "sqlx", "surrealdb"],
                            "description": "Pure domain core with zero external IO/SDK dependencies"
                        },
                        "ports": {
                            "allowed_deps": ["domain"],
                            "forbidden_external": ["tauri", "tokio"],
                            "description": "Abstract repository and driver traits"
                        },
                        "application": {
                            "allowed_deps": ["domain", "ports"],
                            "forbidden_external": ["tauri", "surrealdb"],
                            "description": "Use cases orchestrating domain entities and ports"
                        },
                        "infrastructure": {
                            "allowed_deps": ["domain", "ports"],
                            "description": "Database adapters, external APIs, filesystem"
                        },
                        "adapters_tauri": {
                            "allowed_deps": ["domain", "ports", "application"],
                            "allowed_external": ["tauri"],
                            "description": "Tauri IPC presentation layer"
                        }
                    },
                    "sla": {
                        "min_testability_score": 80.0,
                        "max_violations_warning": 5,
                        "max_violations_deny": 0
                    }
                },
                "frontend": {
                    "ast": {
                        "enforce_shallow_ref": true,
                        "ban_deep_watcher": true,
                        "max_dom_nodes_threshold": 50,
                        "enforce_raii_cleanup": true
                    },
                    "fsd": {
                        "enabled": true,
                        "hierarchy": ["app", "pages", "widgets", "features", "entities", "shared"]
                    },
                    "css": {
                        "ban_hex_colors": true,
                        "ban_raw_rgb": true,
                        "ban_named_colors": true,
                        "enforce_design_tokens": true
                    }
                },
                "limits": {
                    "max_file_loc": 500,
                    "max_fn_loc": 50,
                    "max_cyclomatic_complexity": 15,
                    "max_cognitive_complexity": 15,
                    "max_fn_params": 5
                }
            }),
            ProjectScope::BackendOnly => serde_json::json!({
                "$schema": "./schema/cerberus.schema.json",
                "backend": {
                    "layers": {
                        "domain": {
                            "allowed_deps": [],
                            "forbidden_external": ["reqwest", "tokio", "tauri", "sqlx", "surrealdb"],
                            "description": "Pure domain core with zero external IO/SDK dependencies"
                        },
                        "ports": {
                            "allowed_deps": ["domain"],
                            "forbidden_external": ["tauri", "tokio"],
                            "description": "Abstract repository and driver traits"
                        },
                        "application": {
                            "allowed_deps": ["domain", "ports"],
                            "forbidden_external": ["tauri", "surrealdb"],
                            "description": "Use cases orchestrating domain entities and ports"
                        },
                        "infrastructure": {
                            "allowed_deps": ["domain", "ports"],
                            "description": "Database adapters, external APIs, filesystem"
                        },
                        "adapters_tauri": {
                            "allowed_deps": ["domain", "ports", "application"],
                            "allowed_external": ["tauri"],
                            "description": "Tauri IPC presentation layer"
                        }
                    },
                    "sla": {
                        "min_testability_score": 80.0,
                        "max_violations_warning": 5,
                        "max_violations_deny": 0
                    }
                },
                "limits": {
                    "max_file_loc": 500,
                    "max_fn_loc": 50,
                    "max_cyclomatic_complexity": 15,
                    "max_cognitive_complexity": 15,
                    "max_fn_params": 5
                }
            }),
            ProjectScope::FrontendOnly => serde_json::json!({
                "$schema": "./schema/cerberus.schema.json",
                "frontend": {
                    "ast": {
                        "enforce_shallow_ref": true,
                        "ban_deep_watcher": true,
                        "max_dom_nodes_threshold": 50,
                        "enforce_raii_cleanup": true
                    },
                    "fsd": {
                        "enabled": true,
                        "hierarchy": ["app", "pages", "widgets", "features", "entities", "shared"]
                    },
                    "css": {
                        "ban_hex_colors": true,
                        "ban_raw_rgb": true,
                        "ban_named_colors": true,
                        "enforce_design_tokens": true
                    }
                },
                "limits": {
                    "max_file_loc": 500,
                    "max_fn_loc": 50,
                    "max_cyclomatic_complexity": 15,
                    "max_cognitive_complexity": 15,
                    "max_fn_params": 5
                }
            }),
        }
        .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn get_unique_temp_dir(suffix: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("cerberus_scaffold_{}_{}", suffix, nanos))
    }

    #[test]
    fn test_scaffold_fullstack_success() {
        let temp_dir = get_unique_temp_dir("test");
        let opts = ScaffoldOptions::new(&temp_dir, ProjectScope::Fullstack)
            .with_adopt(true);

        let report = ScaffoldUseCase::execute(&opts).expect("Scaffold should succeed");
        assert_eq!(report.scope, ProjectScope::Fullstack);
        assert!(temp_dir.join("cerberus.json").exists());
        assert!(temp_dir.join("CERBERUS.md").exists());
        assert!(temp_dir.join("cerberus-baseline.json").exists());

        let config_str = fs::read_to_string(temp_dir.join("cerberus.json")).unwrap();
        assert!(config_str.contains("\"backend\""));
        assert!(config_str.contains("\"frontend\""));

        let md_str = fs::read_to_string(temp_dir.join("CERBERUS.md")).unwrap();
        assert!(md_str.contains("CERBERUS ARCHITECTURAL CONSTITUTION"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_backend_only() {
        let temp_dir = get_unique_temp_dir("be");
        let opts = ScaffoldOptions::new(&temp_dir, ProjectScope::BackendOnly);

        let report = ScaffoldUseCase::execute(&opts).expect("Scaffold should succeed");
        assert_eq!(report.scope, ProjectScope::BackendOnly);

        let config_str = fs::read_to_string(temp_dir.join("cerberus.json")).unwrap();
        assert!(config_str.contains("\"backend\""));
        assert!(!config_str.contains("\"frontend\""));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_frontend_only() {
        let temp_dir = get_unique_temp_dir("fe");
        let opts = ScaffoldOptions::new(&temp_dir, ProjectScope::FrontendOnly);

        let report = ScaffoldUseCase::execute(&opts).expect("Scaffold should succeed");
        assert_eq!(report.scope, ProjectScope::FrontendOnly);

        let config_str = fs::read_to_string(temp_dir.join("cerberus.json")).unwrap();
        assert!(!config_str.contains("\"backend\""));
        assert!(config_str.contains("\"frontend\""));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_already_exists_behavior() {
        let temp_dir = get_unique_temp_dir("err");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(temp_dir.join("cerberus.json"), "{}").unwrap();
        fs::write(temp_dir.join("CERBERUS.md"), "# Old").unwrap();

        let opts = ScaffoldOptions::new(&temp_dir, ProjectScope::Fullstack);
        let report = ScaffoldUseCase::execute(&opts).unwrap();
        assert!(report.created_files.is_empty());
        assert!(report.message.contains("already initialized"));

        // With force it overwrites
        let force_opts = opts.with_force(true);
        let force_report = ScaffoldUseCase::execute(&force_opts).unwrap();
        assert!(!force_report.created_files.is_empty());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_scaffold_types_and_derives() {
        let scope = ProjectScope::Fullstack;
        let scope_copy = scope;
        assert_eq!(scope, scope_copy);
        let _ = format!("{:?}", scope);
        let _ = format!("{:?}", ProjectScope::BackendOnly);
        let _ = format!("{:?}", ProjectScope::FrontendOnly);

        let opts = ScaffoldOptions::new("path", ProjectScope::BackendOnly)
            .with_adopt(false)
            .with_force(false);
        let opts_clone = opts.clone();
        assert_eq!(opts, opts_clone);
        let _ = format!("{:?}", opts);

        let report = ScaffoldReport {
            created_files: vec!["cerberus.json".into()],
            scope: ProjectScope::FrontendOnly,
            adopted_violations_count: 0,
            message: "ok".into(),
        };
        let report_clone = report.clone();
        assert_eq!(report, report_clone);
        let _ = format!("{:?}", report);
    }

    #[test]
    fn test_scaffold_io_error_branches() {
        // 1. Create dir error
        let temp_dir = get_unique_temp_dir("io_err");
        fs::create_dir_all(&temp_dir).unwrap();
        let regular_file = temp_dir.join("file.txt");
        fs::write(&regular_file, "text").unwrap();
        let bad_sub_path = regular_file.join("sub");
        let opts = ScaffoldOptions::new(&bad_sub_path, ProjectScope::Fullstack);
        assert!(ScaffoldUseCase::execute(&opts).is_err());

        // 2. cerberus.json write error
        let temp_dir2 = get_unique_temp_dir("io_err2");
        fs::create_dir_all(temp_dir2.join("cerberus.json")).unwrap();
        let opts2 = ScaffoldOptions::new(&temp_dir2, ProjectScope::Fullstack).with_force(true);
        assert!(ScaffoldUseCase::execute(&opts2).is_err());

        // 3. CERBERUS.md write error
        let temp_dir3 = get_unique_temp_dir("io_err3");
        fs::create_dir_all(temp_dir3.join("CERBERUS.md")).unwrap();
        let opts3 = ScaffoldOptions::new(&temp_dir3, ProjectScope::Fullstack).with_force(true);
        assert!(ScaffoldUseCase::execute(&opts3).is_err());

        // 4. cerberus-baseline.json write error
        let temp_dir4 = get_unique_temp_dir("io_err4");
        fs::create_dir_all(temp_dir4.join("cerberus-baseline.json")).unwrap();
        let opts4 = ScaffoldOptions::new(&temp_dir4, ProjectScope::Fullstack)
            .with_adopt(true)
            .with_force(true);
        assert!(ScaffoldUseCase::execute(&opts4).is_err());

        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::remove_dir_all(&temp_dir2);
        let _ = fs::remove_dir_all(&temp_dir3);
        let _ = fs::remove_dir_all(&temp_dir4);
    }
}
