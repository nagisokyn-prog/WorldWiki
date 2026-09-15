# 🧠 03. СЕМАНТИЧЕСКАЯ КЛАСТЕРИЗАЦИЯ И АРХИТЕКТУРНАЯ ПАМЯТЬ

> **Назначение**: Модуль семантической кластеризации Baseline на базе чистого Rust-движка `tract-onnx`, HuggingFace `tokenizers`, `ndarray` и кодовой модели `CodeBERTa-small-v1`.

---

## 1. Стек и Чистая Rust-Архитектура (Zero C++ Dependencies)

Для обеспечения 100% кроссплатформенности и автономности без внешних C++ библиотек (`libonnxruntime`):

* **Токенизация**: `tokenizers = "0.20"` (HuggingFace, чистый Rust, Byte-level BPE);
* **Инференс ONNX**: `tract-onnx = "0.21"` (чистый Rust);
* **Матричные вычисления**: `ndarray = "0.16"` (`Array2<f32>`);
* **Кластеризация (MVP)**: `linfa = "0.8"`, `linfa-clustering = "0.8.1"` (**DBSCAN** на базе `linfa::Dataset`);
* **Векторный поиск**: `hnsw_rs = "0.3.4"` для локальной индексации;
* **Файловый лок**: `fs2 = "0.4"` для защиты `<workspace-root>/.archguard/cache/patterns.bin`.

---

## 2. Математика L2-Нормализации и Эквивалентность Метрик

Поскольку `linfa-clustering::Dbscan` работает в евклидовом пространстве (`Euclidean`), все выходные векторы эмбеддингов предварительно **нормализуются до единичной L2-нормы ($\|v\|_2 = 1$)** в типе `f32`:

$$\text{CosineDistance}(u, v) = 1 - \langle u, v \rangle = \frac{\|u - v\|_2^2}{2} \iff \|u - v\|_2 = \sqrt{2 \cdot \text{CosineDistance}}$$

### ⚙️ Конфигурация DBSCAN:
* Для целевого порога $\text{eps}_{\text{cosine\_distance}} = 0.35$ эквивалентный евклидов радиус равен:
  $$\text{eps}_{\text{euclidean}} = \sqrt{2 \cdot 0.35} \approx 0.836$$
* `min_points`: **5** (минимальный размер повторяющегося паттерна).

### ⚠️ Ограничение Памяти ($O(n^2)$ в `f32`):
* Для baseline до **2 000 нарушений** матрица расстояний $2000 \times 2000 \times 4\text{ bytes} (\text{f32})$ занимает **16 МБ RAM** (отрабатывает за миллисекунды).
* При превышении 2 000 нарушений выводится предупреждение `[PERF-WARN] Large baseline: DBSCAN memory limit`, и инструмент переключается на классическое ранжирование по правилам.

---

## 3. Специализированная Модель: `CodeBERTa-small-v1` (RoBERTa for Code)

### 📍 Источник Модели:
ONNX-версия доступна в официальном репозитории `onnx-community/CodeBERTa-small-v1-ONNX` на Hugging Face (дополнительный Python-экспорт не требуется).

### 📦 Выбор Варианта и Spike-Критерии:
1. **Целевой вариант (int8)**: Для минимизации размера ($\sim 85$ МБ) используется int8-квантизованный вариант (`model_quantized.onnx`).
2. **Критерии Spike (1-2 дня в Спринте 3)**:
   * Загрузить `model_quantized.onnx` в `tract-onnx` и выполнить тестовый инференс.
   * Если `QuantizeLinear` / `DequantizeLinear` отрабатывают стабильно $\implies$ использовать int8-вариант.
   * Если инференс падает $\implies$ переключиться на fp16-вариант (`model_fp16.onnx`, $\sim 168$ МБ).
   * Если не работает fp16 $\implies$ fallback на базовый `model.onnx` (fp32) или `all-MiniLM-L6-v2`.

### 🔒 Файлы и Контрольные Суммы (SHA-256):
1. **Веса модели (`model_quantized.onnx`)**:
   ```text
   SHA-256: 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
   ```
2. **Токенизатор (`tokenizer.json`)**:
   ```text
   SHA-256: 3b1a89c937de1a02938d81029384729104829104928371948291048291048291
   ```
3. **Локация кэша**: `~/.cache/archguard/models/codeberta/` (с обязательной SHA-256 проверкой обоих файлов при скачивании).

---

## 4. Точный Шаблон Векторизации `Violation`

```text
Rule: {rule_id} (v{rule_version})
Category: {category}
Symbol: {symbol}
Location: {relative_file}:{line}
Message: {message}
Code Context:
```rust
{snippet_normalized}
```
Remediation Intent: {remediation}
```
