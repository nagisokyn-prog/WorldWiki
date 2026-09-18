use crate::synthetic_matrix::generator_trait::BenchmarkScorecardEntry;
use colored::Colorize;

pub struct ScorecardPrinter;

impl ScorecardPrinter {
    pub fn print_scorecard(entries: &[BenchmarkScorecardEntry]) {
        println!("\n{}", "=".repeat(126).cyan().bold());
        println!(
            "{}",
            "🏛️  CERBERUS 2.0 UNIVERSAL ARCHITECTURAL STRESS MATRIX & TESTABILITY SCORECARD"
                .yellow()
                .bold()
        );
        println!("{}", "=".repeat(126).cyan().bold());

        println!(
            "{:<42} {:>6} {:>8} {:>10} {:>16} {:>9} {:>12} {:>8} {:>8} {:>8}",
            "Paradigm", "Files", "SLOC", "Time (ms)", "Throughput", "RSS (MB)", "TI Score", "Recall", "Prec", "F1"
        );
        println!("{}", "-".repeat(126).blue());

        let mut total_files = 0;
        let mut total_sloc = 0;
        let mut total_duration_ms = 0.0;
        let mut sum_tp = 0;
        let mut sum_fp = 0;
        let mut sum_fn = 0;
        let mut max_rss = 0.0;
        let mut sum_ti = 0.0;

        for e in entries {
            total_files += e.total_files;
            total_sloc += e.total_sloc;
            total_duration_ms += e.duration_ms;
            sum_tp += e.true_positives;
            sum_fp += e.false_positives;
            sum_fn += e.false_negatives;
            sum_ti += e.testability_score;
            if e.peak_rss_mb > max_rss {
                max_rss = e.peak_rss_mb;
            }

            let recall_str = format!("{:.1}%", e.recall * 100.0);
            let prec_str = format!("{:.1}%", e.precision * 100.0);
            let f1_str = format!("{:.4}", e.f1_score);
            let throughput_str = format!("{:.0} SLOC/s", e.throughput_sloc_per_sec);
            let ti_str = format!("{:.1} ({})", e.testability_score, e.testability_tier);

            println!(
                "{:<42} {:>6} {:>8} {:>9.2}ms {:>16} {:>7.1} MB {:>12} {:>8} {:>8} {:>8}",
                e.paradigm_name.green(),
                e.total_files,
                e.total_sloc,
                e.duration_ms,
                throughput_str,
                e.peak_rss_mb,
                ti_str.magenta(),
                recall_str.cyan(),
                prec_str.cyan(),
                f1_str.bold()
            );
        }

        println!("{}", "=".repeat(126).cyan().bold());

        let total_recall = if sum_tp + sum_fn > 0 {
            sum_tp as f64 / (sum_tp + sum_fn) as f64
        } else {
            1.0
        };
        let total_prec = if sum_tp + sum_fp > 0 {
            sum_tp as f64 / (sum_tp + sum_fp) as f64
        } else {
            1.0
        };
        let total_f1 = if total_recall + total_prec > 0.0 {
            2.0 * (total_recall * total_prec) / (total_recall + total_prec)
        } else {
            0.0
        };
        let total_throughput = if total_duration_ms > 0.0 {
            (total_sloc as f64 / total_duration_ms) * 1000.0
        } else {
            0.0
        };

        let avg_ti = if !entries.is_empty() {
            sum_ti / entries.len() as f64
        } else {
            100.0
        };

        println!(
            "{:<42} {:>6} {:>8} {:>9.2}ms {:>14.0} SLOC/s {:>7.1} MB {:>10.1} TI {:>7.1}% {:>7.1}% {:>8.4}",
            "🏆 COMPOSITE TOTAL".yellow().bold(),
            total_files,
            total_sloc,
            total_duration_ms,
            total_throughput,
            max_rss,
            avg_ti,
            total_recall * 100.0,
            total_prec * 100.0,
            total_f1
        );
        println!("{}", "=".repeat(126).cyan().bold());

        println!("\n📋 {}", "SLA VERIFICATION REPORT:".bold());
        let recall_check = if total_recall >= 0.95 {
            format!("[✔] Recall >= 0.95 (Actual: {:.4})", total_recall).green()
        } else {
            format!("[✘] Recall >= 0.95 FAILED (Actual: {:.4})", total_recall).red()
        };
        let prec_check = if total_prec >= 0.90 {
            format!("[✔] Precision >= 0.90 (Actual: {:.4})", total_prec).green()
        } else {
            format!("[✘] Precision >= 0.90 FAILED (Actual: {:.4})", total_prec).red()
        };
        let thr_check = if total_throughput >= 100_000.0 {
            format!("[✔] Throughput >= 100k SLOC/s (Actual: {:.0} SLOC/s)", total_throughput).green()
        } else {
            format!("[!] Throughput SLA (Actual: {:.0} SLOC/s)", total_throughput).yellow()
        };
        let rss_check = if max_rss < 1200.0 {
            format!("[✔] Peak RSS < 1.2 GB (Actual: {:.1} MB)", max_rss).green()
        } else {
            format!("[✘] Peak RSS < 1.2 GB FAILED (Actual: {:.1} MB)", max_rss).red()
        };

        println!("  {}", recall_check);
        println!("  {}", prec_check);
        println!("  {}", thr_check);
        println!("  {}", rss_check);
        println!("{}", "=".repeat(110).cyan().bold());
    }
}
