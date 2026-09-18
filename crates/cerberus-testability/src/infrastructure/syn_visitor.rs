use syn::spanned::Spanned;
use syn::visit::Visit;
use syn::{
    Expr, ExprCall, ExprMethodCall, ExprUnsafe, FnArg, GenericParam, ImplItemFn, ItemFn, ItemImpl,
    ItemStatic, ItemStruct, ItemType, Path, TraitItemFn, Type, TypeParamBound,
};
use crate::domain::archetype::TestabilityArchetype;
use crate::domain::factor::TestabilityFactor;
use crate::domain::friction::TestFriction;
use crate::domain::layer::LayerContext;

/// AST Визитор для поиска факторов сопротивления тестируемости и классификации по 5 каноническим архетипам
pub struct TestabilityAstVisitor {
    pub layer: LayerContext,
    pub frictions: Vec<TestFriction>,
    pub triggers: Vec<String>,
    pub archetype: TestabilityArchetype,
    in_constructor: bool,
    raw_source: String,
}

impl TestabilityAstVisitor {
    #[must_use]
    pub fn new(layer: LayerContext, raw_source: String) -> Self {
        Self {
            layer,
            frictions: Vec::new(),
            triggers: Vec::new(),
            archetype: TestabilityArchetype::Pure,
            in_constructor: false,
            raw_source,
        }
    }

    fn path_to_string(path: &Path) -> String {
        path.segments
            .iter()
            .map(|s| s.ident.to_string())
            .collect::<Vec<_>>()
            .join("::")
    }

    fn extract_line_col(_span: proc_macro2::Span) -> (usize, usize) {
        (1, 1)
    }

    pub fn record_trigger(&mut self, archetype: TestabilityArchetype, trigger: impl Into<String>) {
        let trigger_str = trigger.into();
        self.triggers.push(trigger_str);
        self.archetype = self.archetype.combine(archetype);
    }

    fn record_friction(
        &mut self,
        factor: TestabilityFactor,
        span: proc_macro2::Span,
        snippet: impl Into<String>,
        message: impl Into<String>,
    ) {
        let (line, column) = Self::extract_line_col(span);
        self.frictions.push(TestFriction {
            factor,
            line,
            column,
            snippet: snippet.into(),
            message: message.into(),
        });
    }

    fn check_path_call(&mut self, path: &Path, span: proc_macro2::Span) {
        let path_str = Self::path_to_string(path);

        // Neutral idioms (Pure): Duration, tracing, log
        if path_str.starts_with("Duration::")
            || path_str.starts_with("tracing::")
            || path_str.starts_with("log::")
        {
            return;
        }

        // F-01 & Flaky triggers: Hidden Ambient Time / Randomness
        if path_str.ends_with("SystemTime::now")
            || path_str.ends_with("Instant::now")
            || path_str.contains("rand::")
            || path_str.ends_with("Uuid::new_v4")
            || path_str.ends_with("env::var")
        {
            self.record_friction(
                TestabilityFactor::F01HiddenAmbientIo,
                span,
                path_str.clone(),
                format!("Недетерминированный вызов окружения `{path_str}` без инверсии через порт"),
            );
            if self.layer == LayerContext::Domain {
                self.record_trigger(
                    TestabilityArchetype::Poisoned,
                    format!("Domain layer violation: non-deterministic call `{path_str}`"),
                );
            } else {
                self.record_trigger(
                    TestabilityArchetype::Flaky,
                    format!("Non-deterministic environment call `{path_str}`"),
                );
            }
        }

        // F-02 & IntBound triggers: Direct OS / FS / Network / Dynamic Linking
        if path_str.starts_with("std::fs")
            || path_str.starts_with("tokio::fs")
            || path_str.starts_with("std::net")
            || path_str.starts_with("tokio::net")
            || path_str.starts_with("reqwest")
            || path_str.starts_with("sqlx")
            || path_str.starts_with("surrealdb")
            || path_str.starts_with("rusqlite")
            || path_str.starts_with("libloading")
            || path_str.contains("Library::new")
            || path_str.contains("Library::get")
            || path_str.starts_with("tauri::")
            || path_str == "File::create"
            || path_str == "File::open"
            || path_str == "TcpStream::connect"
            || path_str == "UdpSocket::bind"
        {
            self.record_friction(
                TestabilityFactor::F02DirectOsFsAccess,
                span,
                path_str.clone(),
                format!("Прямой доступ к ресурсам ОС/сети/динамической линковке `{path_str}`"),
            );
            if self.layer == LayerContext::Domain {
                self.record_trigger(
                    TestabilityArchetype::Poisoned,
                    format!("Domain layer violation: direct I/O `{path_str}`"),
                );
            } else {
                self.record_trigger(
                    TestabilityArchetype::IntBound,
                    format!("Direct I/O or network dependency `{path_str}`"),
                );
            }
        }

        // CONC-002 & Flaky triggers: Orphan concurrency
        if path_str == "tokio::spawn" || path_str == "async_std::task::spawn" {
            self.record_friction(
                TestabilityFactor::Conc002OrphanConcurrency,
                span,
                path_str.clone(),
                "Запуск фоновой асинхронной задачи `tokio::spawn` без сохранения handle",
            );
            if self.layer == LayerContext::Domain {
                self.record_trigger(
                    TestabilityArchetype::Poisoned,
                    "Domain layer violation: asynchronous task spawning",
                );
            } else {
                self.record_trigger(
                    TestabilityArchetype::Flaky,
                    "Orphan asynchronous task spawning `tokio::spawn`",
                );
            }
        }

        // F-04: Constructor side effect check
        if self.in_constructor
            && (path_str.contains("connect")
                || path_str.contains("open")
                || path_str.contains("write")
                || path_str.contains("read")
                || path_str.contains("fs::")
                || path_str.contains("spawn")
                || path_str.contains("reqwest")
                || path_str.contains("sqlx")
                || path_str.contains("TcpStream")
                || path_str.contains("File::create"))
        {
            self.record_friction(
                TestabilityFactor::F04SideEffectingConstructor,
                span,
                path_str.clone(),
                format!("Побочный I/O эффект `{path_str}` в теле конструктора"),
            );
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                format!("Side-effecting constructor containing I/O `{path_str}`"),
            );
        }
    }

    fn check_type_for_mockable_or_flaky(&mut self, ty: &Type) {
        let type_tokens = quote::quote!(#ty).to_string();

        if type_tokens.contains("Rc < RefCell") || type_tokens.contains("Rc<RefCell") {
            self.record_trigger(TestabilityArchetype::Flaky, "Shared mutable state `Rc<RefCell<T>>`");
            return;
        }

        if type_tokens.contains("dyn ") || type_tokens.contains("dyn") {
            if !type_tokens.contains("std :: error :: Error") && !type_tokens.contains("Error") {
                self.record_trigger(TestabilityArchetype::Mockable, "Dynamic dispatch trait object in path");
            }
            return;
        }

        if type_tokens.contains("impl ") || type_tokens.contains("impl") {
            self.record_trigger(TestabilityArchetype::Mockable, "impl Trait interface abstraction");
            return;
        }

        if type_tokens.contains("Future") || type_tokens.contains("Stream") {
            self.record_trigger(TestabilityArchetype::Mockable, "Abstract async Future/Stream abstraction");
        }
    }
}

impl<'ast> Visit<'ast> for TestabilityAstVisitor {
    // Visit all types in AST for Mockable/Flaky triggers
    fn visit_type(&mut self, node: &'ast Type) {
        self.check_type_for_mockable_or_flaky(node);
        syn::visit::visit_type(self, node);
    }

    // Function argument typing check
    fn visit_fn_arg(&mut self, node: &'ast FnArg) {
        if let FnArg::Typed(pat_type) = node {
            self.check_type_for_mockable_or_flaky(&pat_type.ty);
        }
        syn::visit::visit_fn_arg(self, node);
    }

    fn visit_trait_item_fn(&mut self, node: &'ast TraitItemFn) {
        for input in &node.sig.inputs {
            if let FnArg::Typed(pat_type) = input {
                self.check_type_for_mockable_or_flaky(&pat_type.ty);
            }
        }
        syn::visit::visit_trait_item_fn(self, node);
    }

    // F-03: Shared Global Mutable State
    fn visit_item_static(&mut self, node: &'ast ItemStatic) {
        let (line, column) = Self::extract_line_col(node.ident.span());
        let ident_name = node.ident.to_string();

        let is_mut = matches!(node.mutability, syn::StaticMutability::Mut(_));
        let type_str = quote::quote!(#node).to_string();

        if is_mut {
            self.frictions.push(TestFriction {
                factor: TestabilityFactor::F03SharedGlobalMutableState,
                line,
                column,
                snippet: format!("static mut {}", ident_name),
                message: format!("Глобальное разделяемое мутабельное состояние в `static mut {}`", ident_name),
            });
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                format!("Unsynchronized global mutable state `static mut {}`", ident_name),
            );
        } else if type_str.contains("Mutex") || type_str.contains("RwLock") || type_str.contains("OnceLock") || type_str.contains("LazyLock") {
            self.frictions.push(TestFriction {
                factor: TestabilityFactor::F03SharedGlobalMutableState,
                line,
                column,
                snippet: format!("static {}", ident_name),
                message: format!("Глобальное синхронизированное мутабельное состояние в `static {}`", ident_name),
            });
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                format!("Global mutable synchronization primitive in `static {}`", ident_name),
            );
        } else if type_str.contains("Atomic") {
            self.frictions.push(TestFriction {
                factor: TestabilityFactor::F03SharedGlobalMutableState,
                line,
                column,
                snippet: format!("static {}", ident_name),
                message: format!("Глобальная атомарная переменная в `static {}`", ident_name),
            });
            self.record_trigger(
                TestabilityArchetype::Flaky,
                format!("Global atomic state in `static {}`", ident_name),
            );
        }

        syn::visit::visit_item_static(self, node);
    }

    // Generic trait bounds check
    fn visit_generic_param(&mut self, node: &'ast GenericParam) {
        if let GenericParam::Type(type_param) = node {
            for bound in &type_param.bounds {
                if let TypeParamBound::Trait(_) = bound {
                    self.record_trigger(
                        TestabilityArchetype::Mockable,
                        format!("Generic trait bound `{}: Trait`", type_param.ident),
                    );
                }
            }
        }
        syn::visit::visit_generic_param(self, node);
    }

    // F-06: Concrete Coupling in Boundary & Structure types
    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        if matches!(node.vis, syn::Visibility::Public(_)) {
            for field in &node.fields {
                let type_str = quote::quote!(#field).to_string();
                if type_str.contains("DatabaseConnection")
                    || type_str.contains("TcpStream")
                    || type_str.contains("Surreal")
                    || type_str.contains("ReqwestClient")
                {
                    let (line, column) = Self::extract_line_col(field.ident.as_ref().map_or(node.ident.span(), |i| i.span()));
                    self.frictions.push(TestFriction {
                        factor: TestabilityFactor::F06ConcreteCouplingInBoundary,
                        line,
                        column,
                        snippet: type_str,
                        message: "Публичное поле структуры жестко привязано к конкретному типу инфраструктуры вместо трейт-объекта".to_string(),
                    });
                    self.record_trigger(
                        TestabilityArchetype::IntBound,
                        "Concrete infrastructure coupling in public struct boundary",
                    );
                }
            }
        }
        syn::visit::visit_item_struct(self, node);
    }

    fn visit_item_type(&mut self, node: &'ast ItemType) {
        syn::visit::visit_item_type(self, node);
    }

    // Constructors tracking (F-04) & functions
    fn visit_item_impl(&mut self, node: &'ast ItemImpl) {
        syn::visit::visit_item_impl(self, node);
    }

    fn visit_impl_item_fn(&mut self, node: &'ast ImplItemFn) {
        let fn_name = node.sig.ident.to_string();
        let is_ctor = fn_name == "new" || fn_name == "default";

        for input in &node.sig.inputs {
            if let FnArg::Typed(pat_type) = input {
                self.check_type_for_mockable_or_flaky(&pat_type.ty);
            }
        }

        if is_ctor {
            self.in_constructor = true;
            syn::visit::visit_impl_item_fn(self, node);
            self.in_constructor = false;
        } else {
            syn::visit::visit_impl_item_fn(self, node);
        }
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let fn_name = node.sig.ident.to_string();
        let is_ctor = fn_name == "new" || fn_name == "default";

        for input in &node.sig.inputs {
            if let FnArg::Typed(pat_type) = input {
                self.check_type_for_mockable_or_flaky(&pat_type.ty);
            }
        }

        if is_ctor {
            self.in_constructor = true;
            syn::visit::visit_item_fn(self, node);
            self.in_constructor = false;
        } else {
            syn::visit::visit_item_fn(self, node);
        }
    }

    // Call expressions (F-01, F-02, CONC-002, F-04)
    fn visit_expr_call(&mut self, node: &'ast ExprCall) {
        if let Expr::Path(ref expr_path) = *node.func {
            self.check_path_call(&expr_path.path, expr_path.path.segments.first().map_or_else(proc_macro2::Span::call_site, |s| s.ident.span()));
        }
        syn::visit::visit_expr_call(self, node);
    }

    // Method calls (e.g. .connect, .unwrap, .expect, .map_err)
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method_name = node.method.to_string();

        if method_name == "unwrap" || method_name == "expect" {
            self.record_trigger(
                TestabilityArchetype::Flaky,
                format!("Explicit unwrap/expect panic hazard `.{method_name}()`"),
            );
        }

        if self.in_constructor && (method_name == "connect" || method_name == "spawn" || method_name == "bind") {
            self.record_friction(
                TestabilityFactor::F04SideEffectingConstructor,
                node.method.span(),
                format!(".{}()", method_name),
                format!("Побочный вызов `.{method_name}()` внутри конструктора"),
            );
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                format!("Side-effecting method call `.{method_name}()` in constructor"),
            );
        }

        // F-05: Heavy closure inspection in combinators
        if method_name == "map_err" || method_name == "unwrap_or_else" || method_name == "and_then" {
            for arg in &node.args {
                if let Expr::Closure(closure) = arg {
                    let closure_tokens = quote::quote!(#closure).to_string();
                    let is_block_with_stmts = if let Expr::Block(ref block_expr) = *closure.body {
                        block_expr.block.stmts.len() > 1
                    } else {
                        false
                    };

                    let is_heavy = is_block_with_stmts || (closure_tokens.contains('{') && closure_tokens.len() > 60);
                    if is_heavy {
                        let (line, column) = Self::extract_line_col(closure.span());
                        self.frictions.push(TestFriction {
                            factor: TestabilityFactor::F05HeavyMultiLineClosure,
                            line,
                            column,
                            snippet: format!(".{}(|...| {{ ... }})", method_name),
                            message: format!("Тяжелое многострочное анонимное замыкание в комбинаторе `.{method_name}`"),
                        });
                    }
                }
            }
        }

        syn::visit::visit_expr_method_call(self, node);
    }

    // Unsafe block verification
    fn visit_expr_unsafe(&mut self, node: &'ast ExprUnsafe) {
        let has_safety_doc = self.raw_source.contains("// SAFETY:") || self.raw_source.contains("/* SAFETY:");
        if self.layer == LayerContext::Domain {
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                "Domain layer violation: unsafe block in pure domain",
            );
        } else if !has_safety_doc {
            self.record_trigger(
                TestabilityArchetype::Poisoned,
                "Undocumented unsafe block without SAFETY: justification",
            );
        } else {
            self.record_trigger(
                TestabilityArchetype::IntBound,
                "Documented unsafe block in infrastructure layer",
            );
        }
        syn::visit::visit_expr_unsafe(self, node);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use syn::visit::Visit;

    #[test]
    fn test_syn_visitor_comprehensive() {
        let code = r#"
            type Alias = u32;
            pub struct Boundary {
                pub db: DatabaseConnection,
            }
            trait Service {
                fn process(&self, param: Arc<dyn Trait>);
            }
            static mut GLOBAL_MUT: i32 = 0;
            static GLOBAL_MTX: std::sync::Mutex<i32> = std::sync::Mutex::new(0);
            static GLOBAL_ATM: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

            fn new() {
                let _ = std::fs::read("a");
            }

            fn execute<T: Clone>(item: T) {
                let res: Result<i32, String> = Ok(1);
                let _ = res.map_err(|e| {
                    let a = 1;
                    let b = 2;
                    format!("{a}_{b}_{e}")
                });
                // SAFETY: Valid pointer
                unsafe {
                    let _ = *std::ptr::null::<i32>();
                }
            }
        "#;

        let syn_file: syn::File = syn::parse_str(code).unwrap();
        let mut visitor = TestabilityAstVisitor::new(LayerContext::Infrastructure, code.to_string());
        visitor.visit_file(&syn_file);

        assert!(!visitor.frictions.is_empty());
        assert_eq!(visitor.archetype, TestabilityArchetype::Poisoned);
    }
}
