#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SurqlType {
    String,
    Int,
    Float,
    Decimal,
    Number,
    Bool,
    Datetime,
    Duration,
    Record(String),
    Array(Box<SurqlType>),
    Object,
    Option(Box<SurqlType>),
    Union(Vec<SurqlType>),
    Null,
    None,
    Any,
    Custom(String),
}

impl SurqlType {
    pub fn parse(raw: &str) -> Self {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return SurqlType::Any;
        }

        if trimmed.contains('|') {
            let parts: Vec<SurqlType> = trimmed
                .split('|')
                .map(|p| SurqlType::parse_single(p.trim()))
                .collect();
            return SurqlType::Union(parts);
        }

        Self::parse_single(trimmed)
    }

    fn parse_single(trimmed: &str) -> Self {
        let lower = trimmed.to_lowercase();
        if lower == "string" {
            return SurqlType::String;
        }
        if lower == "int" || lower == "integer" {
            return SurqlType::Int;
        }
        if lower == "float" {
            return SurqlType::Float;
        }
        if lower == "decimal" {
            return SurqlType::Decimal;
        }
        if lower == "number" {
            return SurqlType::Number;
        }
        if lower == "bool" || lower == "boolean" {
            return SurqlType::Bool;
        }
        if lower == "datetime" {
            return SurqlType::Datetime;
        }
        if lower == "duration" {
            return SurqlType::Duration;
        }
        if lower == "null" {
            return SurqlType::Null;
        }
        if lower == "none" {
            return SurqlType::None;
        }
        if lower == "any" {
            return SurqlType::Any;
        }
        if lower == "object" || lower.starts_with("object<") {
            return SurqlType::Object;
        }

        if lower.starts_with("record<") && lower.ends_with('>') {
            let inner = &trimmed[7..trimmed.len() - 1].trim();
            return SurqlType::Record(inner.to_string());
        }

        if lower.starts_with("array<") && lower.ends_with('>') {
            let inner = &trimmed[6..trimmed.len() - 1].trim();
            return SurqlType::Array(Box::new(SurqlType::parse(inner)));
        }
        if lower == "array" {
            return SurqlType::Array(Box::new(SurqlType::Any));
        }

        if lower.starts_with("option<") && lower.ends_with('>') {
            let inner = &trimmed[7..trimmed.len() - 1].trim();
            return SurqlType::Option(Box::new(SurqlType::parse(inner)));
        }

        SurqlType::Custom(trimmed.to_string())
    }

    pub fn is_nullable(&self) -> bool {
        match self {
            Self::Null => true,
            Self::Option(inner) => inner.is_nullable(),
            Self::Union(types) => types.iter().any(|t| t.is_nullable()),
            _ => false,
        }
    }

    pub fn is_bool_nullable_hazard(&self) -> bool {
        match self {
            Self::Union(types) => {
                let has_bool = types.iter().any(|t| matches!(t, Self::Bool));
                let has_null = types.iter().any(|t| matches!(t, Self::Null));
                has_bool && has_null
            }
            Self::Option(inner) => inner.is_bool_nullable_hazard(),
            _ => false,
        }
    }

    pub fn is_collection(&self) -> bool {
        match self {
            Self::Array(_) | Self::Object => true,
            Self::Option(inner) => inner.is_collection(),
            Self::Union(types) => types.iter().any(|t| t.is_collection()),
            _ => false,
        }
    }
}
