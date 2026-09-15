# ⚙️ 04. ПРИНЦИП ХРАПОВИКА И КРИПТОГРАФИЧЕСКИЙ РЕЕСТР

> **Назначение**: Механика безболезненного внедрения (Ratchet Baseline), авто-разрешение merge-конфликтов и криптографический реестр исключений (HMAC Ledger).

---

## 1. Абстракция `KeyStorage` и Защита от Mock в Продакшене

```rust
pub trait KeyStorage: Send + Sync {
    fn load_key(&self) -> Result<Option<Vec<u8>>, KeyStorageError>;
    fn save_key(&self, key: &[u8]) -> Result<(), KeyStorageError>;
}
```

### 📍 Реализации:
1. **`KeychainStorage`**: OS Keychain (Windows Credential Manager / macOS Keychain).
2. **`FileStorage`**: fallback для Linux/WSL/Headless на файл `~/.config/archguard/master.key` (права `0600`).
3. **`MockStorage`**: строго для unit-тестов.
   * 🛑 **Security Guard**: Использование `ARCHGUARD_KEY_BACKEND=mock` разрешено **только** при явном флаге `ARCH_GUARD_MODE=dev`. В CI/Prod запуск с mock немедленно завершает процесс с ошибкой `Exit 1`.

---

## 2. Авто-Разрешение Merge-Конфликтов и Установка Хуков

### ⚙️ Настройка в `.gitattributes`:
```gitattributes
guardian-baseline.json merge=union
```

### 🪝 Установка Git Hooks (`arch-guard init --hooks`):
Команда инициализации настраивает хуки через `simple-git-hooks` (в `package.json`) или нативные скрипты `.git/hooks/`:
* **`post-merge` hook**: запускает `cargo arch-guard baseline reconcile` сразу после слияния веток.
* **`pre-commit` hook**: проверяет валидность JSON и блокирует коммиты с неразрешенными нарушениями.

### 🛠️ Алгоритм `cargo arch-guard baseline reconcile`:
1. Устойчиво парсит `fingerprint` хэши даже при поврежденной склейке `][`;
2. Удаляет хэши нарушений, уже исправленных в коде;
3. Сортирует массив детерминированно и сохраняет чистый `guardian-baseline.json`.

---

## 3. Защита от Гонки Процессов (File Locking)

* Файлы локального кэша `<workspace-root>/.archguard/cache/patterns.bin` защищаются через крейт `fs2`:
  * **Чтение**: `shared_lock()`;
  * **Запись**: `exclusive_lock()`.
* Это исключает повреждение бинарных индексов при одновременной работе IDE watcher и CLI.

---

## 4. Семантика Команды `re-sign --all`

```bash
cargo arch-guard ledger re-sign --all
```

* Валидирует существующие подписи старым ключом;
* Запрашивает новый мастер-ключ и обновляет `keyFingerprint`;
* Проставляет `reSignedAt: "2026-09-15T12:00:00Z"` для каждой записи;
* Флаг `--force` требует явного подтверждения разработчика при утере старого ключа.

---

## 5. Исключения в `.gitignore`

```gitignore
# Arch Guard temporary reports & caches
target/arch-guard/
.archguard/cache/
```
