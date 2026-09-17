use syn::spanned::Spanned;
use syn::visit::Visit;
use syn::{Expr, ExprCall, ExprMethodCall, ItemFn, ItemImpl, ItemStatic, ItemStruct, Path};
use crate::domain::factor::TestabilityFactor;
use crate::domain::friction::TestFriction;

/// AST Визитор для поиска факторов сопротивления тестируемости (F-01..F-06, CONC-002)
pub struct TestabilityAstVisitor {
    pub frictions: Vec<TestFriction>,
    in_constructor: bool,
}

impl TestabilityAstVisitor {
    #[must_use]
    pub fn new() -> Self {
        Self {
            frictions: Vec::new(),
            in_constructor: false,
        }
    }

    fn path_to_string(path: &Path) -> String {
        path.segments
            .iter()
            .map(|s| s.ident.to_string())
            .collect::<Vec<_>>()
            .join("::")
    }

    fn extract_line_col(span: proc_macro2::Span) -> (usize, usize) {
        let start = span.start();
        (start.line, start.column + 1)
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

        // F-01: Hidden Ambient I/O
        if path_str.ends_with("SystemTime::now")
            || path_str.ends_with("Instant::now")
            || path_str.contains("rand::")
            || path_str.ends_with("Uuid::new_v4")
        {
            self.record_friction(
                TestabilityFactor::F01HiddenAmbientIo,
                span,
                path_str.clone(),
                format!("Недетерминированный вызов окружения `{path_str}` без инверсии через порт"),
            );
        }

        // F-02: Direct OS / FS Access
        if path_str.starts_with("std::fs")
            || path_str.starts_with("tokio::fs")
            || path_str.starts_with("std::net")
            || path_str.starts_with("tokio::net")
            || path_str.starts_with("reqwest")
            || path_str == "File::create"
            || path_str == "File::open"
        {
            self.record_friction(
                TestabilityFactor::F02DirectOsFsAccess,
                span,
                path_str.clone(),
                format!("Прямой доступ к ресурсам ОС/сети `{path_str}` без абстракции"),
            );
        }

        // CONC-002: Orphan concurrency via tokio::spawn
        if path_str == "tokio::spawn" || path_str == "async_std::task::spawn" {
            self.record_friction(
                TestabilityFactor::Conc002OrphanConcurrency,
                span,
                path_str.clone(),
                "Запуск фоновой асинхронной задачи `tokio::spawn` без гарантий отмены или сохранения handle",
            );
        }

        // F-04: Constructor side effect check
        if self.in_constructor
            && (path_str.contains("connect")
                || path_str.contains("open")
                || path_str.contains("write")
                || path_str.contains("read")
                || path_str.contains("fs::")
                || path_str.contains("spawn"))
        {
            self.record_friction(
                TestabilityFactor::F04SideEffectingConstructor,
                span,
                path_str.clone(),
                format!("Побочный I/O эффект `{path_str}` в теле конструктора"),
            );
        }
    }
}

impl Default for TestabilityAstVisitor {
    fn default() -> Self {
        Self::new()
    }
}

impl<'ast> Visit<'ast> for TestabilityAstVisitor {
    // F-03: Shared Global Mutable State
    fn visit_item_static(&mut self, node: &'ast ItemStatic) {
        let (line, column) = Self::extract_line_col(node.ident.span());
        let ident_name = node.ident.to_string();

        let is_mut = matches!(node.mutability, syn::StaticMutability::Mut(_));
        let type_str = quote::quote!(#node).to_string();

        if is_mut || type_str.contains("Mutex") || type_str.contains("RwLock") || type_str.contains("Atomic") {
            self.frictions.push(TestFriction {
                factor: TestabilityFactor::F03SharedGlobalMutableState,
                line,
                column,
                snippet: format!("static mut {}", ident_name),
                message: format!("Глобальное разделяемое мутабельное состояние в `static {}`", ident_name),
            });
        }

        syn::visit::visit_item_static(self, node);
    }

    // F-06: Concrete Coupling in Boundary (Public Struct fields)
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
                }
            }
        }
        syn::visit::visit_item_struct(self, node);
    }

    // Constructors tracking (F-04)
    fn visit_item_impl(&mut self, node: &'ast ItemImpl) {
        for item in &node.items {
            if let syn::ImplItem::Fn(impl_fn) = item {
                let fn_name = impl_fn.sig.ident.to_string();
                let is_ctor = fn_name == "new" || fn_name == "default";
                if is_ctor {
                    self.in_constructor = true;
                    self.visit_impl_item_fn(impl_fn);
                    self.in_constructor = false;
                } else {
                    self.visit_impl_item_fn(impl_fn);
                }
            }
        }
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let fn_name = node.sig.ident.to_string();
        let is_ctor = fn_name == "new" || fn_name == "default";
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

    // Method calls (e.g. .connect, .unwrap_or_else with closure)
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let method_name = node.method.to_string();
        if self.in_constructor && (method_name == "connect" || method_name == "spawn") {
            self.record_friction(
                TestabilityFactor::F04SideEffectingConstructor,
                node.method.span(),
                format!(".{}()", method_name),
                format!("Побочный вызов `.{method_name}()` внутри конструктора"),
            );
        }

        // F-05: Heavy closure inspection in combinators
        if method_name == "map_err" || method_name == "unwrap_or_else" || method_name == "and_then" {
            for arg in &node.args {
                if let Expr::Closure(closure) = arg {
                    let start_line = closure.span().start().line;
                    let end_line = closure.span().end().line;
                    let line_span = end_line.saturating_sub(start_line) + 1;
                    if line_span > 2 {
                        let (line, column) = Self::extract_line_col(closure.span());
                        self.frictions.push(TestFriction {
                            factor: TestabilityFactor::F05HeavyMultiLineClosure,
                            line,
                            column,
                            snippet: format!(".{}(|...| {{ ... }}) [{} lines]", method_name, line_span),
                            message: format!("Тяжелое многострочное анонимное замыкание ({line_span} строк) в комбинаторе `.{method_name}`"),
                        });
                    }
                }
            }
        }

        syn::visit::visit_expr_method_call(self, node);
    }
}
