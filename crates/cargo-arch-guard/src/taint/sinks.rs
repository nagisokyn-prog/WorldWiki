use syn::Expr;

pub struct TaintSinkDetector;

impl TaintSinkDetector {
    pub fn is_dangerous_sink(expr: &Expr) -> Option<&'static str> {
        let expr_str = quote::quote!(#expr).to_string();

        if expr_str.contains("Command :: new") || expr_str.contains("std :: process :: Command") {
            return Some("Process execution sink: Command::new");
        }

        if expr_str.contains("tokio :: process :: Command") {
            return Some("Async process execution sink: tokio::process::Command");
        }

        None
    }
}
