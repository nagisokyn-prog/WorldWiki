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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sink_detector() {
        let cmd_expr: syn::Expr = syn::parse_str("Command::new(\"sh\")").unwrap();
        assert!(TaintSinkDetector::is_dangerous_sink(&cmd_expr).is_some());

        let tokio_cmd_expr: syn::Expr = syn::parse_str("tokio::process::Command::new(\"sh\")").unwrap();
        assert!(TaintSinkDetector::is_dangerous_sink(&tokio_cmd_expr).is_some());

        let safe_expr: syn::Expr = syn::parse_str("println!(\"hello\")").unwrap();
        assert!(TaintSinkDetector::is_dangerous_sink(&safe_expr).is_none());
    }
}

