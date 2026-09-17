use std::path::Path;

pub struct SlocCalculator;

impl SlocCalculator {
    pub fn count_sloc(content: &str, file_path: &Path) -> usize {
        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "rs" => Self::count_rust_sloc(content),
            "vue" => Self::count_vue_sloc(content),
            _ => Self::count_c_style_sloc(content),
        }
    }

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

            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed.get(pos + 2..).unwrap_or("").trim();
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
                    let remainder = trimmed.get(end_pos + 2..).unwrap_or("").trim();
                    if !remainder.is_empty() && !remainder.starts_with("//") {
                        clean_lines += 1;
                    }
                }
                continue;
            }

            if trimmed.starts_with("//") || trimmed.starts_with("///") || trimmed.starts_with("//!") {
                continue;
            }

            clean_lines += 1;
        }

        clean_lines
    }

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
                    let remainder = trimmed.get(pos + 2..).unwrap_or("").trim();
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
                    let remainder = trimmed.get(end_pos + 2..).unwrap_or("").trim();
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

    pub fn count_vue_sloc(content: &str) -> usize {
        let mut clean_lines = 0;
        let mut in_block_comment = false;
        let mut in_html_comment = false;

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

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

            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed.get(pos + 2..).unwrap_or("").trim();
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
                    let remainder = trimmed.get(end_pos + 2..).unwrap_or("").trim();
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
