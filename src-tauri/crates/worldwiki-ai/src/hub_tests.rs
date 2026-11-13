use super::*;

#[test]
fn detects_standard_quants() {
    assert_eq!(detect_quant_from_filename("model-Q4_K_M.gguf"), "Q4_K_M");
    assert_eq!(detect_quant_from_filename("model-Q4_K_S.gguf"), "Q4_K_S");
    assert_eq!(detect_quant_from_filename("model-Q5_K_M.gguf"), "Q5_K_M");
    assert_eq!(detect_quant_from_filename("model-q8_0.gguf"), "Q8_0");
}

#[test]
fn case_insensitive() {
    assert_eq!(detect_quant_from_filename("MODEL-q4_k_m.GGUF"), "Q4_K_M");
    assert_eq!(
        detect_quant_from_filename("QwEn-Q8_0-Instruct.gguf"),
        "Q8_0"
    );
}

#[test]
fn detects_turboquant_family() {
    assert_eq!(
        detect_quant_from_filename("nemotron-TURBO3_TCQ.gguf"),
        "TCQ (2.25-bit)"
    );
    assert_eq!(detect_quant_from_filename("x_TCQ_y.gguf"), "TCQ (2.25-bit)");
    assert_eq!(
        detect_quant_from_filename("qwen-TURBO2.gguf"),
        "TurboQuant 2-bit"
    );
    assert_eq!(
        detect_quant_from_filename("qwen-TQ1.gguf"),
        "TurboQuant 2-bit"
    );
    assert_eq!(
        detect_quant_from_filename("qwen-TURBO3.gguf"),
        "TurboQuant 3-bit"
    );
    assert_eq!(
        detect_quant_from_filename("qwen-TURBO4.gguf"),
        "TurboQuant 4-bit"
    );
    assert_eq!(
        detect_quant_from_filename("qwen-TQ2.gguf"),
        "TurboQuant 4-bit"
    );
}

#[test]
fn tcq_has_priority_over_other_turbo_marks() {
    assert_eq!(
        detect_quant_from_filename("TURBO3_TCQ_final.gguf"),
        "TCQ (2.25-bit)"
    );
}

#[test]
fn detects_half_precision() {
    assert_eq!(detect_quant_from_filename("model-BF16.gguf"), "F16");
    assert_eq!(detect_quant_from_filename("model-f16.gguf"), "F16");
}

#[test]
fn unknown_quant_defaults_to_gguf() {
    assert_eq!(detect_quant_from_filename("plain-model.gguf"), "GGUF");
    assert_eq!(detect_quant_from_filename(""), "GGUF");
    assert_eq!(detect_quant_from_filename("IQ2_XS.gguf"), "GGUF");
}

