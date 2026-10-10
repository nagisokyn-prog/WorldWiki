use cerberus_domain::{compute_fingerprint, Category, Severity, Violation};
use std::path::Path;

pub struct FeErrorRulesChecker;

impl FeErrorRulesChecker {
    pub fn check_source(content: &str, file_path: &Path) -> Vec<Violation> {
        let mut violations = Vec::new();

        let path_str = file_path.to_string_lossy();
        if path_str.contains(".spec.") || path_str.contains(".test.") || path_str.contains("__tests__") {
            return violations;
        }

        let is_app_code = path_str.contains("src") || path_str.contains("apps") || path_str.contains("packages");
        if !is_app_code {
            return violations;
        }

        let file_stem = file_path.file_stem().map_or("ts_module", |s| s.to_str().unwrap_or("ts_module"));

        // FE-ERR-001: Empty Catch Block (Optional Catch Binding or empty body)
        // Matches `catch { }`, `catch { /* ignore */ }`, `catch (e) { }`, etc.
        let lines: Vec<&str> = content.lines().collect();
        for (idx, line) in lines.iter().enumerate() {
            let trimmed = line.trim();

            if trimmed.starts_with("catch") || trimmed.contains(" catch ") || trimmed.contains("} catch") {
                // Check single-line empty catch: catch { /* ignore */ } or catch (e) {}
                let is_single_line_empty = (trimmed.contains("catch {") || trimmed.contains("catch ("))
                    && trimmed.ends_with('}')
                    && !trimmed.contains("console.")
                    && !trimmed.contains("throw")
                    && !trimmed.contains("toast")
                    && !trimmed.contains("alert")
                    && !trimmed.contains("emit");

                // Check multi-line empty catch
                let is_multiline_empty = if (trimmed.ends_with("catch {") || (trimmed.contains("catch (") && trimmed.ends_with('{'))) && idx + 1 < lines.len() {
                    let next_line = lines[idx + 1].trim();
                    next_line == "}" || (next_line.starts_with("/*") && next_line.ends_with("*/") && idx + 2 < lines.len() && lines[idx + 2].trim() == "}")
                } else {
                    false
                };

                if is_single_line_empty || is_multiline_empty {
                    let snippet = if is_single_line_empty {
                        trimmed.to_string()
                    } else {
                        format!("{}\n{}", trimmed, lines[idx + 1].trim())
                    };

                    let fp = compute_fingerprint("FE-ERR-001", "1.0", file_stem, &snippet);
                    violations.push(Violation {
                        rule_id: "FE-ERR-001".into(),
                        rule_version: "1.0".into(),
                        category: Category::Frontend,
                        severity: Severity::Deny,
                        file: file_path.to_path_buf(),
                        line: idx + 1,
                        column: 1,
                        symbol: "empty_catch_block".into(),
                        message: "Empty catch block silently swallows runtime exceptions without analysis, recovery or telemetry.".into(),
                        snippet,
                        remediation: "Handle error explicitly, log with context, or propagate to caller.".into(),
                        fingerprint: fp,
                    });
                }
            }

            // FE-ERR-003: Raw Project ID String Interpolation
            // e.g. `projects:${props.project}` or `projects:${projectName}` without projectRecordId()
            if (trimmed.contains("`projects:${") || trimmed.contains("\"projects:\" +") || trimmed.contains("'projects:' +"))
                && !content.contains("export const projectRecordId")
                && !content.contains("function projectRecordId")
            {
                let snippet = trimmed.to_string();
                let fp = compute_fingerprint("FE-ERR-003", "1.0", file_stem, &snippet);
                violations.push(Violation {
                    rule_id: "FE-ERR-003".into(),
                    rule_version: "1.0".into(),
                    category: Category::Frontend,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: idx + 1,
                    column: 1,
                    symbol: "raw_project_id_concat".into(),
                    message: "Raw project ID string interpolation detected. Manual concatenation with existing angle brackets causes double-escaping (projects:⟨⟨id⟩⟩).".into(),
                    snippet,
                    remediation: "Use central projectRecordId(name) utility to sanitize angle brackets and quotes before constructing record IDs.".into(),
                    fingerprint: fp,
                });
            }

            // FE-ERR-004: Unchecked (e as any) in catch block
            if (trimmed.contains("(e as any)") || trimmed.contains("(err as any)") || trimmed.contains("(error as any)"))
                && (trimmed.contains(".message") || trimmed.contains("alert") || trimmed.contains("log"))
            {
                let snippet = trimmed.to_string();
                let fp = compute_fingerprint("FE-ERR-004", "1.0", file_stem, &snippet);
                violations.push(Violation {
                    rule_id: "FE-ERR-004".into(),
                    rule_version: "1.0".into(),
                    category: Category::Frontend,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: idx + 1,
                    column: 1,
                    symbol: "catch_as_any".into(),
                    message: "Unchecked type assertion '(e as any)' in error handler. Thrown non-Error values cause runtime TypeError crashes.".into(),
                    snippet,
                    remediation: "Use formatErrorMessage(e) or 'instanceof Error' type narrowing.".into(),
                    fingerprint: fp,
                });
            }
        }

        // FE-ERR-002: Silent Mutation Catch Without User Notification
        // In store files or manuscript shell, check if mutation functions catch errors and only call addLog / console.log without toast/alert
        if (path_str.contains("store") || path_str.contains("manuscript") || path_str.contains("services"))
            && content.contains("async")
            && (content.contains("createChapter") || content.contains("saveChapter") || content.contains("saveCalendar") || content.contains("deleteChapter"))
        {
            // If the file contains deps.addLog(...) inside catch without addToast / appAlert
            if content.contains("deps.addLog") && !content.contains("deps.addToast") && !content.contains("appAlert") {
                let snippet = "deps.addLog(..., 'error') without UI notification".to_string();
                let fp = compute_fingerprint("FE-ERR-002", "1.0", file_stem, &snippet);
                violations.push(Violation {
                    rule_id: "FE-ERR-002".into(),
                    rule_version: "1.0".into(),
                    category: Category::Frontend,
                    severity: Severity::Deny,
                    file: file_path.to_path_buf(),
                    line: 1,
                    column: 1,
                    symbol: "silent_mutation_catch".into(),
                    message: "Mutation function catches errors into internal log without showing Toast or Alert to user.".into(),
                    snippet,
                    remediation: "Show user-facing notification via deps.addToast(...) or appAlert(...) when data mutations fail.".into(),
                    fingerprint: fp,
                });
            }
        }

        violations
    }
}
