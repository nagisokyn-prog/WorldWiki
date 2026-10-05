use std::collections::HashSet;
use syn::visit::{self, Visit};
use syn::{Expr, ExprMethodCall, File};

/// Bevy scan context containing project metadata and Phase 1 scheduled systems discovery.
#[derive(Debug, Clone, Default)]
pub struct BevyScanContext {
    /// true if Cargo.toml has bevy dependency
    pub is_bevy_project: bool,
    /// Parsed semantic version of bevy (e.g. 0.19.1)
    pub bevy_version: Option<semver::Version>,
    /// Update schedule system function names discovered during Phase 1
    pub update_systems: HashSet<String>,
    /// Startup schedule system function names discovered during Phase 1
    pub startup_systems: HashSet<String>,
}

impl BevyScanContext {
    pub fn new(is_bevy_project: bool, bevy_version: Option<semver::Version>) -> Self {
        Self {
            is_bevy_project,
            bevy_version,
            update_systems: HashSet::new(),
            startup_systems: HashSet::new(),
        }
    }

    pub fn from_cargo_toml(content: &str) -> Self {
        let is_bevy = content.contains("bevy");
        let version = Self::parse_bevy_version(content);
        Self {
            is_bevy_project: is_bevy,
            bevy_version: version,
            update_systems: HashSet::new(),
            startup_systems: HashSet::new(),
        }
    }

    pub fn parse_bevy_version(content: &str) -> Option<semver::Version> {
        let re1 = regex::Regex::new(r#"bevy\s*=\s*[{]?\s*version\s*=\s*"([^"]+)""#).ok()?;
        if let Some(cap) = re1.captures(content) {
            if let Some(m) = cap.get(1) {
                if let Ok(v) = semver::Version::parse(m.as_str()) {
                    return Some(v);
                }
            }
        }

        let re2 = regex::Regex::new(r#"bevy\s*=\s*"([^"]+)""#).ok()?;
        if let Some(cap) = re2.captures(content) {
            if let Some(m) = cap.get(1) {
                if let Ok(v) = semver::Version::parse(m.as_str()) {
                    return Some(v);
                }
            }
        }

        None
    }

    pub fn is_version_at_least(&self, major: u64, minor: u64) -> bool {
        self.bevy_version
            .as_ref()
            .is_some_and(|v| v.major > major || (v.major == major && v.minor >= minor))
    }

    /// Phase 1 workspace/file pass to discover literal system registrations in add_systems(Schedule, ...)
    pub fn collect_systems_phase1(&mut self, file: &File) {
        let mut collector = SystemRegistrationCollector {
            update_systems: &mut self.update_systems,
            startup_systems: &mut self.startup_systems,
        };
        collector.visit_file(file);
    }
}

struct SystemRegistrationCollector<'a> {
    update_systems: &'a mut HashSet<String>,
    startup_systems: &'a mut HashSet<String>,
}

impl<'a, 'ast> Visit<'ast> for SystemRegistrationCollector<'a> {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        if node.method == "add_systems" && node.args.len() >= 2 {
            let arg0 = &node.args[0];
            let schedule_str = quote::quote!(#arg0).to_string();
            let systems_arg = &node.args[1];

            let is_update = schedule_str.contains("Update") || schedule_str.contains("PreUpdate") || schedule_str.contains("PostUpdate");
            let is_startup = schedule_str.contains("Startup") || schedule_str.contains("PreStartup") || schedule_str.contains("PostStartup");

            if is_update {
                extract_system_identifiers(systems_arg, self.update_systems);
            } else if is_startup {
                extract_system_identifiers(systems_arg, self.startup_systems);
            }
        } else if (node.method == "add_startup_system" || node.method == "add_startup_systems") && !node.args.is_empty() {
            extract_system_identifiers(&node.args[0], self.startup_systems);
        } else if node.method == "add_system" && !node.args.is_empty() {
            extract_system_identifiers(&node.args[0], self.update_systems);
        }

        visit::visit_expr_method_call(self, node);
    }
}

fn extract_system_identifiers(expr: &Expr, target: &mut HashSet<String>) {
    match expr {
        Expr::Path(p) => {
            if let Some(seg) = p.path.segments.last() {
                target.insert(seg.ident.to_string());
            }
        }
        Expr::Tuple(t) => {
            for elem in &t.elems {
                extract_system_identifiers(elem, target);
            }
        }
        Expr::MethodCall(mc) => {
            extract_system_identifiers(&mc.receiver, target);
            for arg in &mc.args {
                extract_system_identifiers(arg, target);
            }
        }
        Expr::Call(c) => {
            extract_system_identifiers(&c.func, target);
            for arg in &c.args {
                extract_system_identifiers(arg, target);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bevy_scan_context_version_parsing() {
        let toml_inline = r#"
            [dependencies]
            bevy = { version = "0.19.1", features = ["dynamic_linking"] }
        "#;
        let ctx = BevyScanContext::from_cargo_toml(toml_inline);
        assert!(ctx.is_bevy_project);
        assert_eq!(ctx.bevy_version, Some(semver::Version::new(0, 19, 1)));
        assert!(ctx.is_version_at_least(0, 16));
        assert!(!ctx.is_version_at_least(0, 20));

        let toml_simple = r#"
            [dependencies]
            bevy = "0.14.0"
        "#;
        let ctx2 = BevyScanContext::from_cargo_toml(toml_simple);
        assert!(ctx2.is_bevy_project);
        assert_eq!(ctx2.bevy_version, Some(semver::Version::new(0, 14, 0)));
        assert!(!ctx2.is_version_at_least(0, 16));
    }

    #[test]
    fn test_phase1_system_collection() {
        let code = r#"
            fn setup_app(app: &mut App) {
                app.add_systems(Startup, init_game);
                app.add_systems(Update, (player_movement, render_world.chain(sync_transforms)));
            }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut ctx = BevyScanContext::new(true, Some(semver::Version::new(0, 19, 1)));
        ctx.collect_systems_phase1(&file);

        assert!(ctx.startup_systems.contains("init_game"));
        assert!(ctx.update_systems.contains("player_movement"));
        assert!(ctx.update_systems.contains("render_world"));
        assert!(ctx.update_systems.contains("sync_transforms"));
    }

    #[test]
    fn test_non_bevy_cargo_toml() {
        let toml_non_bevy = r#"
            [dependencies]
            serde = "1.0"
        "#;
        let ctx = BevyScanContext::from_cargo_toml(toml_non_bevy);
        assert!(!ctx.is_bevy_project);
        assert_eq!(ctx.bevy_version, None);
        assert!(!ctx.is_version_at_least(0, 16));
    }

    #[test]
    fn test_wildcard_bevy_version() {
        let toml_wildcard = r#"
            [dependencies]
            bevy = "*"
        "#;
        let ctx = BevyScanContext::from_cargo_toml(toml_wildcard);
        assert!(ctx.is_bevy_project);
        assert_eq!(ctx.bevy_version, None);
        assert!(!ctx.is_version_at_least(0, 16));
    }

    #[test]
    fn test_legacy_system_registration_collection() {
        let code = r#"
            fn setup_app(app: &mut App) {
                app.add_startup_system(init_legacy);
                app.add_system(update_legacy);
            }
        "#;
        let file: syn::File = syn::parse_str(code).unwrap();
        let mut ctx = BevyScanContext::new(true, Some(semver::Version::new(0, 11, 0)));
        ctx.collect_systems_phase1(&file);

        assert!(ctx.startup_systems.contains("init_legacy"));
        assert!(ctx.update_systems.contains("update_legacy"));
    }
}
