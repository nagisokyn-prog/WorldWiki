use cerberus_infrastructure::SlocCalculator;
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
    assert_eq!(SlocCalculator::count_sloc("", &PathBuf::from("empty.rs")), 0);
    assert_eq!(SlocCalculator::count_sloc("   \n\t\n   \r\n", &PathBuf::from("spaces.rs")), 0);

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

    let inline_comment_with_code = "/* comment */ pub const X: i32 = 10;";
    assert_eq!(SlocCalculator::count_sloc(inline_comment_with_code, &PathBuf::from("inline.rs")), 1);

    let inline_comment_with_line_comment = "/* comment */ // line comment";
    assert_eq!(SlocCalculator::count_sloc(inline_comment_with_line_comment, &PathBuf::from("inline.rs")), 0);

    let multiline_ending_with_code = r#"
/*
 * start comment
 */ let y = 20;
"#;
    assert_eq!(SlocCalculator::count_sloc(multiline_ending_with_code, &PathBuf::from("multi.rs")), 1);

    let unclosed_comment = "/* this comment is never closed\nstill in comment\n";
    assert_eq!(SlocCalculator::count_sloc(unclosed_comment, &PathBuf::from("unclosed.rs")), 0);

    let unclosed_html_comment = "<!-- unclosed html\ntemplate\n";
    assert_eq!(SlocCalculator::count_sloc(unclosed_html_comment, &PathBuf::from("unclosed.vue")), 0);

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

    let unknown_code = "print('hello')\n# comment\n// comment\n";
    assert_eq!(SlocCalculator::count_sloc(unknown_code, &PathBuf::from("script.unknown")), 2);
}
