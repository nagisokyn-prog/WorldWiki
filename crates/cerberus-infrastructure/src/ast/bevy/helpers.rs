use syn::punctuated::Punctuated;
use syn::visit::{self, Visit};
use syn::{
    Attribute, BinOp, Block, Expr, ExprAssign, ExprBinary, ExprMethodCall, ExprPath, FnArg,
    GenericArgument, Pat, Path, PathArguments, Signature, Token, Type,
};

/// Convert a syn::Path to a double-colon joined string: "std::thread::sleep"
pub fn path_to_string(path: &Path) -> String {
    let mut parts = Vec::new();
    for s in &path.segments {
        parts.push(s.ident.to_string());
    }
    parts.join("::")
}

/// Convert an expression to a path string if it is an Expr::Path
pub fn expr_to_path_string(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Path(ExprPath { path, .. }) => Some(path_to_string(path)),
        Expr::Field(field_expr) => {
            let base = expr_to_path_string(&field_expr.base)?;
            let member = match &field_expr.member {
                syn::Member::Named(ident) => ident.to_string(),
                syn::Member::Unnamed(idx) => idx.index.to_string(),
            };
            Some(format!("{}.{}", base, member))
        }
        Expr::Unary(syn::ExprUnary {
            op: syn::UnOp::Deref(_),
            expr: inner,
            ..
        }) => expr_to_path_string(inner),
        _ => None,
    }
}

/// Check if attributes list contains a `#[derive(..., Name, ...)]`
pub fn has_derive(attrs: &[Attribute], name: &str) -> bool {
    for attr in attrs {
        if !attr.path().is_ident("derive") {
            continue;
        }
        if let Ok(args) = attr.parse_args_with(Punctuated::<Path, Token![,]>::parse_terminated) {
            for p in &args {
                if p.is_ident(name) {
                    return true;
                }
            }
        }
    }
    false
}

/// Extract inner generic type name from a wrapper: ResMut<MyType> -> "MyType"
pub fn extract_generic_arg(ty: &Type, wrapper: &str) -> Option<String> {
    let Type::Path(tp) = ty else { return None };
    let seg = tp.path.segments.last()?;
    if seg.ident != wrapper {
        return None;
    }
    let PathArguments::AngleBracketed(args) = &seg.arguments else {
        return None;
    };
    let GenericArgument::Type(inner) = args.args.first()? else {
        return None;
    };
    Some(type_to_string(inner))
}

/// Convert a Type to a string representation including generics and paths
pub fn type_to_string(ty: &Type) -> String {
    quote::quote!(#ty).to_string()
}

pub struct MethodCallCounter<'a> {
    pub name: &'a str,
    pub count: usize,
}

impl<'a, 'ast> Visit<'ast> for MethodCallCounter<'a> {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        if node.method == self.name {
            self.count += 1;
        }
        visit::visit_expr_method_call(self, node);
    }
}

/// Count how many times method_name is called within a Block
pub fn count_method_in_block(block: &Block, method_name: &str) -> usize {
    let mut c = MethodCallCounter {
        name: method_name,
        count: 0,
    };
    c.visit_block(block);
    c.count
}

pub struct VarWriteDetector<'a> {
    pub var: &'a str,
    pub found: bool,
}

impl<'a, 'ast> Visit<'ast> for VarWriteDetector<'a> {
    fn visit_expr_assign(&mut self, node: &'ast ExprAssign) {
        if let Some(s) = expr_to_path_string(&node.left) {
            if s.split('.').next().unwrap_or(&s) == self.var || s.contains(self.var) {
                self.found = true;
            }
        }
        visit::visit_expr_assign(self, node);
    }

    fn visit_expr_binary(&mut self, node: &'ast ExprBinary) {
        let is_assign_op = matches!(
            node.op,
            BinOp::AddAssign(_)
                | BinOp::SubAssign(_)
                | BinOp::MulAssign(_)
                | BinOp::DivAssign(_)
                | BinOp::RemAssign(_)
                | BinOp::BitXorAssign(_)
                | BinOp::BitAndAssign(_)
                | BinOp::BitOrAssign(_)
                | BinOp::ShlAssign(_)
                | BinOp::ShrAssign(_)
        );
        if is_assign_op {
            if let Some(s) = expr_to_path_string(&node.left) {
                if s.split('.').next().unwrap_or(&s) == self.var || s.contains(self.var) {
                    self.found = true;
                }
            }
        }
        visit::visit_expr_binary(self, node);
    }

    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        let m = node.method.to_string();
        if matches!(
            m.as_str(),
            "iter_mut"
                | "get_mut"
                | "single_mut"
                | "par_iter_mut"
                | "set_if_neq"
                | "set"
                | "push"
                | "insert"
                | "clear"
        ) {
            if let Some(s) = expr_to_path_string(&node.receiver) {
                if s.split('.').next().unwrap_or(&s) == self.var || s.contains(self.var) {
                    self.found = true;
                }
            }
        }
        visit::visit_expr_method_call(self, node);
    }

    fn visit_expr_reference(&mut self, node: &'ast syn::ExprReference) {
        if node.mutability.is_some() {
            if let Some(s) = expr_to_path_string(&node.expr) {
                if s.split('.').next().unwrap_or(&s) == self.var || s.contains(self.var) {
                    self.found = true;
                }
            }
        }
        visit::visit_expr_reference(self, node);
    }
}

/// Detect if block contains ANY form of write/mutation to var_name:
/// 1. Direct assignment (*var = ..., var.field = ...)
/// 2. Compound assignment (+=, -=, *=, /=, etc.)
/// 3. Mutable method calls (.iter_mut(), .get_mut(), .single_mut(), .par_iter_mut())
/// 4. Mutable borrowing (&mut var)
pub fn block_has_write_to_var(block: &Block, var_name: &str) -> bool {
    let mut d = VarWriteDetector {
        var: var_name,
        found: false,
    };
    d.visit_block(block);
    d.found
}

/// Find parameter variable names and their inner generic types for a specific wrapper:
/// e.g. wrapper="ResMut", sig has `mut health: ResMut<Health>` -> [("health", "Health")]
pub fn find_param_names_with_wrapper(sig: &Signature, wrapper: &str) -> Vec<(String, String)> {
    let mut result = Vec::new();
    for arg in &sig.inputs {
        let FnArg::Typed(pt) = arg else { continue };
        let Pat::Ident(pi) = pt.pat.as_ref() else { continue };
        if let Some(inner) = extract_generic_arg(&pt.ty, wrapper) {
            result.push((pi.ident.to_string(), inner));
        }
    }
    result
}

/// Find parameters with type Query<&mut T, ...> -> [("var_name", "T")]
pub fn find_mut_query_params(sig: &Signature) -> Vec<(String, String)> {
    let mut result = Vec::new();
    for arg in &sig.inputs {
        let FnArg::Typed(pt) = arg else { continue };
        let Pat::Ident(pi) = pt.pat.as_ref() else { continue };
        let Type::Path(tp) = pt.ty.as_ref() else { continue };
        let Some(seg) = tp.path.segments.last() else { continue };
        if seg.ident != "Query" {
            continue;
        }
        let PathArguments::AngleBracketed(ab) = &seg.arguments else { continue };
        let Some(GenericArgument::Type(first_ty)) = ab.args.first() else { continue };
        if let Type::Reference(r) = first_ty {
            if r.mutability.is_some() {
                result.push((pi.ident.to_string(), type_to_string(&r.elem)));
            }
        }
    }
    result
}

/// Find all parameter names whose type is Query<...>
pub fn find_query_param_names(sig: &Signature) -> Vec<String> {
    let mut result = Vec::new();
    for arg in &sig.inputs {
        let FnArg::Typed(pt) = arg else { continue };
        let Pat::Ident(pi) = pt.pat.as_ref() else { continue };
        let Type::Path(tp) = pt.ty.as_ref() else { continue };
        if let Some(seg) = tp.path.segments.last() {
            if seg.ident == "Query" {
                result.push(pi.ident.to_string());
            }
        }
    }
    result
}

pub struct MethodCallSearcher<'a> {
    pub var: &'a str,
    pub method: &'a str,
    pub found: bool,
}

impl<'a, 'ast> Visit<'ast> for MethodCallSearcher<'a> {
    fn visit_expr_method_call(&mut self, node: &'ast ExprMethodCall) {
        if node.method == self.method {
            if let Some(s) = expr_to_path_string(&node.receiver) {
                if s.split('.').next().unwrap_or(&s) == self.var || s.contains(self.var) {
                    self.found = true;
                }
            }
        }
        visit::visit_expr_method_call(self, node);
    }
}

/// Check if a block calls .method() on a receiver matching var_name
pub fn block_calls_method_on_var(block: &Block, var_name: &str, method: &str) -> bool {
    let mut s = MethodCallSearcher {
        var: var_name,
        method,
        found: false,
    };
    s.visit_block(block);
    s.found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_and_expr_to_string() {
        let path: Path = syn::parse_str("std::thread::sleep").unwrap();
        assert_eq!(path_to_string(&path), "std::thread::sleep");

        let expr_path: Expr = syn::parse_str("std::thread::sleep").unwrap();
        assert_eq!(expr_to_path_string(&expr_path), Some("std::thread::sleep".into()));

        let expr_field: Expr = syn::parse_str("player.health").unwrap();
        assert_eq!(expr_to_path_string(&expr_field), Some("player.health".into()));

        let expr_tuple_field: Expr = syn::parse_str("tuple.0").unwrap();
        assert_eq!(expr_to_path_string(&expr_tuple_field), Some("tuple.0".into()));

        let expr_deref: Expr = syn::parse_str("*transform").unwrap();
        assert_eq!(expr_to_path_string(&expr_deref), Some("transform".into()));

        let expr_lit: Expr = syn::parse_str("42").unwrap();
        assert_eq!(expr_to_path_string(&expr_lit), None);
    }

    #[test]
    fn test_has_derive_helper() {
        let item_with_derive: syn::ItemStruct = syn::parse_str(
            "#[derive(Component, Clone, Resource)]\npub struct Health;"
        ).unwrap();
        assert!(has_derive(&item_with_derive.attrs, "Component"));
        assert!(has_derive(&item_with_derive.attrs, "Resource"));
        assert!(!has_derive(&item_with_derive.attrs, "Event"));

        let item_no_attrs: syn::ItemStruct = syn::parse_str("pub struct Plain;").unwrap();
        assert!(!has_derive(&item_no_attrs.attrs, "Component"));
    }

    #[test]
    fn test_extract_generic_arg_and_type_to_string() {
        let ty_res_mut: Type = syn::parse_str("ResMut<PlayerHealth>").unwrap();
        assert_eq!(extract_generic_arg(&ty_res_mut, "ResMut"), Some("PlayerHealth".into()));
        assert_eq!(extract_generic_arg(&ty_res_mut, "Res"), None);

        let ty_plain: Type = syn::parse_str("u32").unwrap();
        assert_eq!(extract_generic_arg(&ty_plain, "ResMut"), None);
        assert_eq!(type_to_string(&ty_plain), "u32");
    }

    #[test]
    fn test_count_method_in_block() {
        let block: Block = syn::parse_str(
            "{\n  x.clone();\n  y.clone();\n  z.unwrap();\n  w.clone();\n}"
        ).unwrap();
        assert_eq!(count_method_in_block(&block, "clone"), 3);
        assert_eq!(count_method_in_block(&block, "unwrap"), 1);
        assert_eq!(count_method_in_block(&block, "despawn"), 0);
    }

    #[test]
    fn test_block_has_write_to_var_and_method_calls() {
        let block_assign: Block = syn::parse_str("{\n  *health = 100;\n}").unwrap();
        assert!(block_has_write_to_var(&block_assign, "health"));
        assert!(!block_has_write_to_var(&block_assign, "mana"));

        let block_compound: Block = syn::parse_str("{\n  health.val += 10;\n}").unwrap();
        assert!(block_has_write_to_var(&block_compound, "health"));

        let block_mut_method: Block = syn::parse_str("{\n  query.iter_mut();\n}").unwrap();
        assert!(block_has_write_to_var(&block_mut_method, "query"));

        let block_ref_mut: Block = syn::parse_str("{\n  modify(&mut target);\n}").unwrap();
        assert!(block_has_write_to_var(&block_ref_mut, "target"));

        let block_read_only: Block = syn::parse_str("{\n  let x = health.val;\n  println!(\"{}\", x);\n}").unwrap();
        assert!(!block_has_write_to_var(&block_read_only, "health"));

        let block_method_call: Block = syn::parse_str("{\n  commands.spawn(Health);\n}").unwrap();
        assert!(block_calls_method_on_var(&block_method_call, "commands", "spawn"));
        assert!(!block_calls_method_on_var(&block_method_call, "commands", "despawn"));
    }

    #[test]
    fn test_find_param_helpers() {
        let fn_item: syn::ItemFn = syn::parse_str(
            "fn system(mut health: ResMut<Health>, q_mut: Query<&mut Transform>, q_imm: Query<&Velocity>) {}"
        ).unwrap();

        let res_muts = find_param_names_with_wrapper(&fn_item.sig, "ResMut");
        assert_eq!(res_muts, vec![("health".into(), "Health".into())]);

        let mut_queries = find_mut_query_params(&fn_item.sig);
        assert_eq!(mut_queries, vec![("q_mut".into(), "Transform".into())]);

        let all_queries = find_query_param_names(&fn_item.sig);
        assert_eq!(all_queries, vec!["q_mut".to_string(), "q_imm".to_string()]);
    }
}
