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

        // Split on top-level '|' (not inside '<...>')
        let mut parts = Vec::new();
        let mut depth = 0usize;
        let mut last = 0;
        for (i, c) in trimmed.char_indices() {
            match c {
                '<' => depth += 1,
                '>' => depth = depth.saturating_sub(1),
                '|' if depth == 0 => {
                    parts.push(&trimmed[last..i]);
                    last = i + 1;
                }
                _ => {}
            }
        }
        if last > 0 {
            parts.push(&trimmed[last..]);
            let parsed_parts: Vec<SurqlType> = parts
                .into_iter()
                .map(|p| SurqlType::parse(p.trim()))
                .collect();
            return SurqlType::Union(parsed_parts);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_primitive_types() {
        assert_eq!(SurqlType::parse(""), SurqlType::Any);
        assert_eq!(SurqlType::parse("string"), SurqlType::String);
        assert_eq!(SurqlType::parse("int"), SurqlType::Int);
        assert_eq!(SurqlType::parse("integer"), SurqlType::Int);
        assert_eq!(SurqlType::parse("float"), SurqlType::Float);
        assert_eq!(SurqlType::parse("decimal"), SurqlType::Decimal);
        assert_eq!(SurqlType::parse("number"), SurqlType::Number);
        assert_eq!(SurqlType::parse("bool"), SurqlType::Bool);
        assert_eq!(SurqlType::parse("boolean"), SurqlType::Bool);
        assert_eq!(SurqlType::parse("datetime"), SurqlType::Datetime);
        assert_eq!(SurqlType::parse("duration"), SurqlType::Duration);
        assert_eq!(SurqlType::parse("null"), SurqlType::Null);
        assert_eq!(SurqlType::parse("none"), SurqlType::None);
        assert_eq!(SurqlType::parse("any"), SurqlType::Any);
        assert_eq!(SurqlType::parse("object"), SurqlType::Object);
        assert_eq!(SurqlType::parse("object<user>"), SurqlType::Object);
        assert_eq!(SurqlType::parse("geometry"), SurqlType::Custom("geometry".to_string()));
    }

    #[test]
    fn test_parse_nested_and_generic_types() {
        assert_eq!(SurqlType::parse("record<users>"), SurqlType::Record("users".to_string()));
        assert_eq!(SurqlType::parse("array"), SurqlType::Array(Box::new(SurqlType::Any)));
        assert_eq!(SurqlType::parse("array<string>"), SurqlType::Array(Box::new(SurqlType::String)));
        assert_eq!(SurqlType::parse("option<int>"), SurqlType::Option(Box::new(SurqlType::Int)));
        assert_eq!(
            SurqlType::parse("option<string | null>"),
            SurqlType::Option(Box::new(SurqlType::Union(vec![SurqlType::String, SurqlType::Null])))
        );
    }

    #[test]
    fn test_type_predicates() {
        let nullable_str = SurqlType::parse("string | null");
        assert!(nullable_str.is_nullable());
        assert!(!nullable_str.is_bool_nullable_hazard());
        assert!(!nullable_str.is_collection());

        let bool_null = SurqlType::parse("bool | null");
        assert!(bool_null.is_nullable());
        assert!(bool_null.is_bool_nullable_hazard());

        let opt_bool_null = SurqlType::parse("option<bool | null>");
        assert!(opt_bool_null.is_nullable());
        assert!(opt_bool_null.is_bool_nullable_hazard());

        let arr_null = SurqlType::parse("array<string> | null");
        assert!(arr_null.is_collection());
        assert!(arr_null.is_nullable());

        let opt_arr = SurqlType::parse("option<array<int>>");
        assert!(opt_arr.is_collection());

        let plain_int = SurqlType::parse("int");
        assert!(!plain_int.is_nullable());
        assert!(!plain_int.is_bool_nullable_hazard());
        assert!(!plain_int.is_collection());
    }
}
