use std::path::Path;

/// Core marker trait for all architectural domain models
pub trait DomainModel: Send + Sync {
    fn model_type(&self) -> &'static str;
}

/// Trait for domain entities that can compute their cryptographic or structural fingerprint
pub trait Fingerprintable {
    fn compute_fingerprint(&self) -> String;
}

/// Domain contract for rule evaluators
pub trait RuleEvaluator: Send + Sync {
    fn rule_id(&self) -> &str;
    fn evaluate_path(&self, path: &Path) -> bool;
}

/// Trait for architectural entities with boundary classification
pub trait ArchitecturalEntity: Send + Sync {
    fn layer_name(&self) -> &str;
    fn is_pure_layer(&self) -> bool;
}

/// Trait for components that calculate metrics
pub trait MetricsProvider: Send + Sync {
    fn pressure_score(&self) -> f64;
    fn is_healthy(&self) -> bool;
}

/// Domain abstraction for publishing diagnostic messages
pub trait DiagnosticReporter: Send + Sync {
    fn report_violation(&self, message: &str);
}

/// Marker trait for immutable domain value objects
pub trait ValueObject: Send + Sync {
    fn is_valid(&self) -> bool;
}

/// Marker trait for domain aggregate roots
pub trait AggregateRoot: Send + Sync {
    fn aggregate_id(&self) -> &str;
}

/// Trait for domain events generated during analysis
pub trait DomainEvent: Send + Sync {
    fn event_name(&self) -> &str;
}

/// Trait for verifying cryptographic suppressions
pub trait SuppressionVerifier: Send + Sync {
    fn verify_suppression(&self, fingerprint: &str) -> bool;
}

impl Fingerprintable for crate::rules::Violation {
    fn compute_fingerprint(&self) -> String {
        self.fingerprint.clone()
    }
}

impl DomainModel for crate::rules::Violation {
    fn model_type(&self) -> &'static str {
        "Violation"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rules::{Category, Severity, Violation};
    use std::path::PathBuf;

    #[test]
    fn test_domain_traits_implementation() {
        let v = Violation {
            rule_id: "ARCH-001".into(),
            rule_version: "1.0".into(),
            category: Category::Architecture,
            severity: Severity::Deny,
            file: PathBuf::from("src/lib.rs"),
            line: 1,
            column: 1,
            symbol: "test".into(),
            snippet: "test snippet".into(),
            message: "msg".into(),
            remediation: "rem".into(),
            fingerprint: "fp123".into(),
        };

        assert_eq!(v.compute_fingerprint(), "fp123");
        assert_eq!(v.model_type(), "Violation");
    }
}
