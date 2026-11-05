extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use crate::types::ExtractedEntityMention;

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
enum LexerState {
    Normal,
    InsideEntity,
}

/// Zero-allocation, high-speed deterministic finite state machine (FSM)
/// to extract all `((Entity))` mentions from manuscript text without regex.
pub fn extract_entity_mentions(text: &str) -> Vec<ExtractedEntityMention> {
    let mut mentions = Vec::new();
    let bytes = text.as_bytes();
    let len = bytes.len();

    let mut byte_idx = 0usize;
    let mut char_idx = 0usize;

    // Track character offsets corresponding to byte indices efficiently
    // We compute character offsets on the fly
    let mut state = LexerState::Normal;
    let mut entity_byte_start = 0usize;
    let mut entity_char_start = 0usize;
    let mut content_byte_start = 0usize;

    while byte_idx < len {
        let b = bytes[byte_idx];

        // Check if character is ASCII or UTF-8 leading byte
        let char_len = if b < 0x80 {
            1
        } else if (b & 0xE0) == 0xC0 {
            2
        } else if (b & 0xF0) == 0xE0 {
            3
        } else if (b & 0xF8) == 0xF0 {
            4
        } else {
            1 // Fallback for invalid UTF-8 byte
        };

        match state {
            LexerState::Normal => {
                // Check for escape backslash: \((
                if b == b'\\' && byte_idx + 2 < len && bytes[byte_idx + 1] == b'(' && bytes[byte_idx + 2] == b'(' {
                    // Skip backslash and the escaped ((
                    byte_idx += 3;
                    char_idx += 3;
                    continue;
                }

                // Check for trigger ((
                if b == b'(' && byte_idx + 1 < len && bytes[byte_idx + 1] == b'(' {
                    entity_byte_start = byte_idx;
                    entity_char_start = char_idx;
                    content_byte_start = byte_idx + 2;
                    state = LexerState::InsideEntity;

                    byte_idx += 2;
                    char_idx += 2;
                    continue;
                }

                byte_idx += char_len;
                char_idx += 1;
            }
            LexerState::InsideEntity => {
                // Disallow newlines inside entity names to avoid run-away parsing across chapters
                if b == b'\n' || b == b'\r' {
                    state = LexerState::Normal;
                    byte_idx += char_len;
                    char_idx += 1;
                    continue;
                }

                // Check for closing ))
                if b == b')' && byte_idx + 1 < len && bytes[byte_idx + 1] == b')' {
                    let raw_bytes = &bytes[content_byte_start..byte_idx];
                    if let Ok(raw_name) = core::str::from_utf8(raw_bytes) {
                        let trimmed = raw_name.trim();
                        if !trimmed.is_empty() {
                            mentions.push(ExtractedEntityMention {
                                name: String::from(trimmed),
                                byte_start: entity_byte_start,
                                byte_end: byte_idx + 2,
                                char_start: entity_char_start,
                                char_end: char_idx + 2,
                            });
                        }
                    }

                    byte_idx += 2;
                    char_idx += 2;
                    state = LexerState::Normal;
                    continue;
                }

                byte_idx += char_len;
                char_idx += 1;
            }
        }
    }

    mentions
}

