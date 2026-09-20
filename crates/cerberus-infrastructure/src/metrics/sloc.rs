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

    pub fn count_script_logic_sloc(content: &str, max_destructure_fields: usize) -> usize {
        let mut clean_lines = 0;
        let mut in_block_comment = false;
        let mut in_import_block = false;
        let mut in_destructure_block = false;
        let mut destructure_buffer = String::new();
        let mut destructure_lines = 0;
        let mut in_type_block = false;
        let mut type_brace_depth: i32 = 0;

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.is_empty() {
                continue;
            }

            if in_block_comment {
                if let Some(pos) = trimmed.find("*/") {
                    in_block_comment = false;
                    let remainder = trimmed.get(pos + 2..).unwrap_or("").trim();
                    if remainder.is_empty() || remainder.starts_with("//") {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            if trimmed.starts_with("/*") {
                if !trimmed.contains("*/") {
                    in_block_comment = true;
                }
                continue;
            }

            if trimmed.starts_with("//") {
                continue;
            }

            // Multi-line import filtering
            if in_import_block {
                if trimmed.contains("from ") || trimmed.ends_with(';') {
                    in_import_block = false;
                }
                continue;
            }
            if trimmed.starts_with("import ") {
                if !trimmed.contains("from ") && !trimmed.ends_with(';') {
                    in_import_block = true;
                }
                continue;
            }

            // Macro definitions & pure glue
            if trimmed.starts_with("defineProps")
                || trimmed.starts_with("const props = defineProps")
                || trimmed.starts_with("defineEmits")
                || trimmed.starts_with("const emit = defineEmits")
                || trimmed.starts_with("defineSlots")
                || trimmed.starts_with("defineOptions")
                || trimmed.starts_with("defineModel")
                || trimmed.starts_with("withDefaults")
            {
                continue;
            }

            // Type/Interface declarations
            if in_type_block {
                for ch in trimmed.chars() {
                    if ch == '{' {
                        type_brace_depth += 1;
                    } else if ch == '}' {
                        type_brace_depth -= 1;
                    }
                }
                if type_brace_depth <= 0 && (trimmed.ends_with(';') || trimmed.ends_with('}')) {
                    in_type_block = false;
                }
                continue;
            }
            if trimmed.starts_with("export interface ")
                || trimmed.starts_with("interface ")
                || trimmed.starts_with("export type ")
                || trimmed.starts_with("type ")
            {
                type_brace_depth = 0;
                for ch in trimmed.chars() {
                    if ch == '{' {
                        type_brace_depth += 1;
                    } else if ch == '}' {
                        type_brace_depth -= 1;
                    }
                }
                if type_brace_depth > 0 || (!trimmed.ends_with(';') && !trimmed.ends_with('}')) {
                    in_type_block = true;
                }
                continue;
            }

            // Multi-line destructuring glue (const { ... } = ...)
            if in_destructure_block {
                destructure_buffer.push_str(trimmed);
                destructure_buffer.push(' ');
                destructure_lines += 1;
                if trimmed.contains("} =") || trimmed.contains("};") || trimmed.ends_with(';') {
                    in_destructure_block = false;
                    if let (Some(start), Some(end)) = (destructure_buffer.find('{'), destructure_buffer.rfind('}')) {
                        let inner = &destructure_buffer[start + 1..end];
                        let fields_count = inner.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).count();
                        if fields_count > max_destructure_fields {
                            clean_lines += destructure_lines;
                        }
                    }
                }
                continue;
            }
            if trimmed.starts_with("const {") || trimmed.starts_with("let {") {
                if trimmed.contains("} =") || trimmed.contains("};") {
                    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
                        let inner = &trimmed[start + 1..end];
                        let fields_count = inner.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).count();
                        if fields_count > max_destructure_fields {
                            clean_lines += 1;
                        }
                    }
                    continue;
                } else {
                    in_destructure_block = true;
                    destructure_buffer.clear();
                    destructure_buffer.push_str(trimmed);
                    destructure_buffer.push(' ');
                    destructure_lines = 1;
                    continue;
                }
            }

            clean_lines += 1;
        }

        clean_lines
    }

    pub fn count_vue_sfc_effective_sloc(sfc: &crate::frontend::sfc_parser::VueSfc, max_destructure_fields: usize) -> usize {
        let mut total = 0;
        if let Some(template) = &sfc.template {
            total += Self::count_vue_sloc(template);
        }
        if let Some(script_setup) = &sfc.script_setup {
            total += Self::count_script_logic_sloc(script_setup, max_destructure_fields);
        }
        if let Some(script) = &sfc.script {
            total += Self::count_script_logic_sloc(script, max_destructure_fields);
        }
        total
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frontend::sfc_parser::VueSfc;

    #[test]
    fn test_script_logic_sloc_filters_boilerplate_glue() {
        let script = r#"
import { ref, computed } from 'vue';
import type { UserProfile, ChatMessage } from './models';
import {
  AiHeader,
  AiChatHistory,
  AiChatTopBar
} from '../../components';

export interface LocalProps {
  id: string;
  count: number;
}

const props = defineProps<LocalProps>();
const emit = defineEmits<{ (e: 'close'): void }>();

const {
  activeProfile,
  messages,
  sendMessage
} = useMyHook();

// Active logic lines:
const count = ref(0);
const doubled = computed(() => count.value * 2);
function increment() {
  count.value += 1;
}
"#;

        let sloc = SlocCalculator::count_script_logic_sloc(script, 3);
        // Only count = ref(0), doubled = computed(...), function increment() {, count.value += 1;, }
        assert_eq!(sloc, 5);

        // Bloated destructuring (> 3 fields) should count as logic
        let bloated_script = r#"
const { a, b, c, d, e } = useGodObject();
"#;
        let bloated_sloc = SlocCalculator::count_script_logic_sloc(bloated_script, 3);
        assert_eq!(bloated_sloc, 1);
    }

    #[test]
    fn test_vue_sfc_effective_sloc() {
        let sfc = VueSfc {
            template: Some(
                r#"
<div class="test-container">
  <h1>Title</h1>
  <p>Content</p>
</div>
"#
                .into(),
            ),
            script_setup: Some(
                r#"
import { ref } from 'vue';
const props = defineProps<{ name: string }>();
const isReady = ref(true);
"#
                .into(),
            ),
            script: None,
            styles: Vec::new(),
            script_setup_start_line: 1,
        };

        let effective = SlocCalculator::count_vue_sfc_effective_sloc(&sfc, 3);
        // template has 4 lines (<div...>, <h1>...</h1>, <p>...</p>, </div>) + script has 1 line (const isReady = ref(true);)
        assert_eq!(effective, 5);
    }
}
