use std::path::Path;

pub struct SlocCalculator;

impl SlocCalculator {
    /// Calculate pure Source Lines of Code (SLOC).
    /// Strips:
    /// - Blank lines and whitespace-only lines
    /// - Single-line comments (`//`, `///`, `//!`, `#` in bash/toml)
    /// - Multi-line comments (`/* ... */`, `<!-- ... -->` in HTML/Vue templates)
    /// - Test modules in Rust (`#[cfg(test)]` or `mod tests { ... }`)
    pub fn count_sloc(content: &str, file_path: &Path) -> usize {
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "rs" => Self::count_rust_sloc(content),
            "vue" => Self::count_vue_sloc(content),
            "ts" | "js" | "tsx" | "jsx" | "css" | "scss" => Self::count_c_style_sloc(content),
            _ => Self::count_c_style_sloc(content),
        }
    }

    /// Count SLOC for Rust files, stripping `#[cfg(test)]` and comments.
    pub fn count_rust_sloc(content: &str) -> usize {
        let mut clean_lines = 0;
        let mut in_block_comment = false;
        let mut in_test_module = false;
        let mut test_module_brace_depth: i32 = 0;

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

            // Check test module start
            if !in_test_module {
                if trimmed.starts_with("#[cfg(test)]") || (trimmed.starts_with("mod tests") && trimmed.contains('{')) {
                    in_test_module = true;
                    test_module_brace_depth = 0;
                    for ch in trimmed.chars() {
                        if ch == '{' {
                            test_module_brace_depth += 1;
                        } else if ch == '}' {
                            test_module_brace_depth -= 1;
                        }
                    }
                    continue;
                }
            } else {
                for ch in trimmed.chars() {
                    if ch == '{' {
                        test_module_brace_depth += 1;
                    } else if ch == '}' {
                        test_module_brace_depth -= 1;
                    }
                }
                if test_module_brace_depth <= 0 {
                    in_test_module = false;
                }
                continue;
            }

            // Handle multi-line comment state
            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed[pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("/*") {
                if !trimmed.contains("*/") {
                    in_block_comment = true;
                } else if let Some(end_pos) = trimmed.find("*/") {
                    let remainder = trimmed[end_pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            // Single line comments in Rust
            if trimmed.starts_with("//") || trimmed.starts_with("///") || trimmed.starts_with("//!") {
                continue;
            }

            clean_lines += 1;
        }

        clean_lines
    }

    /// Count SLOC for C-style languages (TS, JS, CSS)
    pub fn count_c_style_sloc(content: &str) -> usize {
        let mut clean_lines = 0;
        let mut in_block_comment = false;

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed[pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("/*") {
                if !trimmed.contains("*/") {
                    in_block_comment = true;
                } else if let Some(end_pos) = trimmed.find("*/") {
                    let remainder = trimmed[end_pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("//") {
                continue;
            }

            clean_lines += 1;
        }

        clean_lines
    }

    /// Count SLOC for Vue SFC files
    pub fn count_vue_sloc(content: &str) -> usize {
        let mut clean_lines = 0;
        let mut in_block_comment = false;
        let mut in_html_comment = false;

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

            // HTML comments <!-- ... -->
            if in_html_comment {
                if trimmed.contains("-->") {
                    in_html_comment = false;
                }
                continue;
            }

            if trimmed.starts_with("<!--") {
                if !trimmed.contains("-->") {
                    in_html_comment = true;
                }
                continue;
            }

            // JS/CSS block comments
            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed[pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("/*") {
                if !trimmed.contains("*/") {
                    in_block_comment = true;
                } else if let Some(end_pos) = trimmed.find("*/") {
                    let remainder = trimmed[end_pos + 2..].trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("//") {
                continue;
            }

            clean_lines += 1;
        }

        clean_lines
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_rust_sloc_with_comments_and_tests() {
        let code = r#"
// This is a single line comment
/// Doc comment
//! Module comment

use std::path::Path;

/*
 * Multi-line comment block
 */
pub fn main() {
    println!("Hello World");
}

/* inline block comment */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
"#;
        let path = PathBuf::from("src/main.rs");
        let sloc = SlocCalculator::count_sloc(code, &path);
        // Code lines:
        // 1. use std::path::Path;
        // 2. pub fn main() {
        // 3.     println!("Hello World");
        // 4. }
        assert_eq!(sloc, 4);
    }

    #[test]
    fn test_c_style_and_vue_sloc() {
        let ts_code = r#"
// single comment
import { ref } from 'vue';

/*
 multi line
*/
export const value = 42;
"#;
        assert_eq!(SlocCalculator::count_sloc(ts_code, &PathBuf::from("app.ts")), 2);

        let vue_code = r#"
<!-- HTML comment -->
<template>
  <div>Hello</div>
</template>

<script setup lang="ts">
// script comment
const title = 'test';
</script>
"#;
        assert_eq!(SlocCalculator::count_sloc(vue_code, &PathBuf::from("App.vue")), 6);
    }

    #[test]
    fn test_sloc_negative_and_edge_cases() {
        // 1. Completely empty string & whitespace only
        assert_eq!(SlocCalculator::count_sloc("", &PathBuf::from("empty.rs")), 0);
        assert_eq!(SlocCalculator::count_sloc("   \n\t\n   \r\n", &PathBuf::from("spaces.rs")), 0);

        // 2. Only comments
        let only_comments = r#"
// line 1
/// doc 2
//! module 3
/*
 multi 4
*/
/* inline 5 */
"#;
        assert_eq!(SlocCalculator::count_sloc(only_comments, &PathBuf::from("comments.rs")), 0);
        assert_eq!(SlocCalculator::count_sloc(only_comments, &PathBuf::from("comments.ts")), 0);
        assert_eq!(SlocCalculator::count_sloc(only_comments, &PathBuf::from("comments.vue")), 0);

        // 3. Inline block comment with code on the same line
        let inline_comment_with_code = "/* comment */ pub const X: i32 = 10;";
        assert_eq!(SlocCalculator::count_sloc(inline_comment_with_code, &PathBuf::from("inline.rs")), 1);

        // 4. Inline block comment followed only by line comment
        let inline_comment_with_line_comment = "/* comment */ // line comment";
        assert_eq!(SlocCalculator::count_sloc(inline_comment_with_line_comment, &PathBuf::from("inline.rs")), 0);

        // 5. Multi-line comment ending with code on the closing line
        let multiline_ending_with_code = r#"
/*
 * start comment
 */ let y = 20;
"#;
        assert_eq!(SlocCalculator::count_sloc(multiline_ending_with_code, &PathBuf::from("multi.rs")), 1);

        // 6. Unclosed block comment (unterminated)
        let unclosed_comment = "/* this comment is never closed\nstill in comment\n";
        assert_eq!(SlocCalculator::count_sloc(unclosed_comment, &PathBuf::from("unclosed.rs")), 0);

        // 7. Unclosed HTML comment in Vue
        let unclosed_html_comment = "<!-- unclosed html\ntemplate\n";
        assert_eq!(SlocCalculator::count_sloc(unclosed_html_comment, &PathBuf::from("unclosed.vue")), 0);

        // 8. Test module ending with real code after it
        let test_module_then_code = r#"
#[cfg(test)]
mod tests {
    #[test]
    fn t() {
        assert!(true);
    }
}

pub fn after_test() -> i32 {
    100
}
"#;
        assert_eq!(SlocCalculator::count_sloc(test_module_then_code, &PathBuf::from("module.rs")), 3);

        // 9. Unknown extension fallback
        let unknown_code = "print('hello')\n# comment\n// comment\n";
        assert_eq!(SlocCalculator::count_sloc(unknown_code, &PathBuf::from("script.unknown")), 2);
    }
}
