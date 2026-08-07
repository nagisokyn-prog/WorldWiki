# План 3: Agent Loop, Clawrust Интеграция и MCP Tools

## Цели и Задачи
- Настроить "мозг" агента внутри Tauri.
- Связать Agent Loop с инструментами WorldWiki.
- Реализовать систему ролей (Режимы: Собеседник, Редактор, Аналитик).

## 1. Agent Loop в Tauri (Rust)
Цикл агента (заимствованный из `claw-code/rust/crates/runtime`) будет работать в асинхронном таске (`tokio::spawn`) на бэкенде.
Примерный флоу работы:
1. Юзер пишет сообщение во Vue.
2. Vue отправляет Tauri команду `send_chat_message(chat_id, text, attachments)`.
3. Tauri формирует промпт, собирает историю (от `leaf_msg_id` вверх) и обрезает её с помощью алгоритма *Context Windowing* (чтобы не превышать лимит токенов).
4. Tauri отправляет запрос к LLM (через `claw-api` к облаку ИЛИ к локальной `llama`).
5. Tauri стримит ответ во Vue через Tauri Events (`chat_stream_chunk`). UI плавно отрисовывает текст.
6. Если LLM выдаёт Tool Call, Tauri приостанавливает стрим текста, посылает во Vue событие `tool_call_requested`.
7. Tauri сверяет Tool Call с правилами **Auto-Approval** (План 2).
   - Если разрешено: выполняет тулз, результат возвращает LLM, цикл продолжается.
   - Если запрещено/требует подтверждения: ждёт Tauri команду `approve_tool_call` от Vue. В это время в UI висит карточка с кнопками "Разрешить / Отклонить".

## 2. Разрешённые инструменты и Режимы (Roles)
Мы берём логику из требований и интегрируем её в системный промпт и доступный набор MCP.

**AgentMode::Chat (Собеседник)**
- **Доступно**: `search_entities`, `get_chapter`, `get_entity`, `get_relations`, `get_timeline`, `get_calendar`.
- Системный промпт не содержит инструкций о том, как изменять мир, только как анализировать и генерировать творческие идеи.

**AgentMode::Edit (Редактор)**
- **Доступно**: Всё из Chat + `create_entity`, `update_entity`, `delete_entity`, `create_relation`, `update_chapter`, `add_timeline_event`.
- Жёсткий запрет на доступ к системным командам (только SDB / инструменты WorldWiki).

**AgentMode::Analyze (Аналитик)**
- **Доступно**: Инструменты из Chat + `get_entity_evolution`, `get_relation_history`, `find_contradictions`, `generate_timeline_report`.

## 3. Пользовательские модели и Провайдеры
В базе данных будет храниться список профилей LLM.
- **Поля**: Provider (OpenAI, Anthropic, Ollama, LocalLlama, OpenRouter), API Key, Base URL, Model Name, Temperature.
- Парсер из `.wwmodels` позволит юзерам добавлять кастомные режимы с собственными наборами тулзов (например, режим "Создатель Имён" без тулзов вообще).
