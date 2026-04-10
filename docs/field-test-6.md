# Intent-Driven Frontend — Полевой тест 0.6.1

## Проверка парадигмы на графовом/инструментальном домене

## Домен: визуальный редактор workflow-пайплайнов

Инструмент для визуального построения и исполнения пайплайнов обработки данных: canvas с узлами и связями, drag-and-drop, несколько типов узлов (HTTP-запрос, трансформация данных, условие, вывод), соединение портов, исполнение пайплайна с визуализацией прогресса, сохранение и загрузка.

**Почему этот домен.** Он принципиально отличается от всех предыдущих:
- **Очередь чтения, магазин, бронирование** — CRUD на сущностях с состояниями. Линейные флоу.
- **Календарь, планирование** — темпоральные и коллаборативные. Фазовые процессы.
- **Workflow-редактор** — **графовый, пространственный, исполняемый**. Сущности имеют координаты. Связи — первоклассные. Исполнение — обход графа в реальном времени.

Если парадигма справляется с описанием инструмента для построения процессов — это сильный сигнал универсальности. Если нет — мы честно фиксируем, что графовые/инструментальные домены выходят за границы.

Ключевые стресс-точки:
- **Пространственные сущности**: узлы имеют x, y — позицию на canvas. Перемещение — это эффект, но без бизнес-смысла
- **Рёбра как первоклассные сущности**: связь между узлами — не поле сущности, а отдельная сущность Edge
- **Исполнение как обход графа**: выполнение пайплайна — это не одно намерение, а процесс обхода графа с эффектами на каждом узле
- **Типизированные порты**: узлы имеют входные и выходные порты определённых типов. Связь валидна только между совместимыми портами

## Онтология

**Сущности:**

`Workflow` — внутренняя. Поля: id, title, status {draft, saved, running, completed, failed}, createdAt. Контейнер для графа.

`Node` — внутренняя. Поля: id, workflowId, type, label, x, y, config, status {idle, running, completed, failed, skipped}. Узел на canvas. Типы: http_request, transform, condition, output.

`Edge` — внутренняя. Поля: id, workflowId, sourceNodeId, sourcePort, targetNodeId, targetPort. Связь между узлами. Первоклассная сущность, не поле.

`NodeType` — внутренняя. Поля: id, name, category, inputs[], outputs[], configSchema. Определение типа узла. Пользовательские типы — расширяемы.

`Execution` — внутренняя. Поля: id, workflowId, status {pending, running, completed, failed}, startedAt, completedAt, results. Запуск пайплайна.

`NodeResult` — внутренняя. Поля: id, executionId, nodeId, status {pending, running, completed, failed, skipped}, output, error, duration. Результат исполнения одного узла.

**Предикаты:**
- `workflow_is_draft(workflow)` ≡ `workflow.status = 'draft'`
- `workflow_is_saved(workflow)` ≡ `workflow.status = 'saved'`
- `node_has_connections(node)` ≡ `∃ edge: edge.sourceNodeId = node.id ∨ edge.targetNodeId = node.id`
- `ports_compatible(source, target)` ≡ `source.output.type = target.input.type`
- `execution_is_running(execution)` ≡ `execution.status = 'running'`

**Правила импликации:**
- Удаление узла → каскадное удаление всех его рёбер
- Начало исполнения → все узлы переходят в pending
- Завершение узла → запуск следующих по рёбрам (топологический обход)
- Condition-узел: true-ветка или false-ветка (skipped)

## Встроенные типы узлов

**http_request** — выполняет HTTP-запрос.
- Inputs: [trigger]
- Outputs: [response]
- Config: { url, method, headers, body }

**transform** — преобразует данные выражением.
- Inputs: [data]
- Outputs: [result]
- Config: { expression }

**condition** — ветвление по условию.
- Inputs: [data]
- Outputs: [true, false] — два выходных порта
- Config: { expression }

**output** — финальный узел, записывает результат.
- Inputs: [data]
- Outputs: []
- Config: { format }

## 18 намерений

### Редактирование (10)

**1. create_workflow — Создать workflow**
```
E: workflow: Workflow
C: []
F: [{ α: add, target: workflows, σ: account }]
W: []
P: click
creates: Workflow(draft)
```

**2. add_node — Добавить узел**
```
E: workflow: Workflow, node: Node
C: [workflow.status IN ('draft', 'saved')]
F: [{ α: add, target: nodes, σ: account }]
W: [node.type, available_types, canvas_position]
P: click/drag
creates: Node
```
Пространственная сущность: x, y задаются при создании (клик на canvas или drag из палитры).

**3. remove_node — Удалить узел**
```
E: node: Node
C: [workflow.status IN ('draft', 'saved')]
F: [{ α: remove, target: nodes, σ: account },
    { α: remove, target: edges, σ: account }]     — каскадное удаление рёбер
W: [node.label, connected_edges.count]
P: click (подтверждение если есть связи)
irreversibility: medium
```
Каскад: удаление узла → удаление всех его рёбер. Это **правиловой эффект**: один эффект логически применяется ко многим сущностям (рёбрам). Проекции разрешают каскад при исполнении.

**4. move_node — Переместить узел**
```
E: node: Node
C: [workflow.status IN ('draft', 'saved')]
F: [{ α: replace, target: node.x, σ: account },
    { α: replace, target: node.y, σ: account }]
W: [node.label, node.x (текущий), node.y (текущий)]
P: drag-end
```
Чисто пространственный эффект — без бизнес-смысла. Интересный случай: это эффект, который не меняет World в семантическом смысле (функциональность пайплайна та же), но меняет проекцию (визуальное расположение).

**5. connect_nodes — Соединить узлы**
```
E: edge: Edge, source: Node, target: Node
C: [workflow.status IN ('draft', 'saved'), ports_compatible(source, target)]
F: [{ α: add, target: edges, σ: account }]
W: [source.label, target.label, source.outputPort.type, target.inputPort.type]
P: drag (от порта к порту)
creates: Edge
```
Проверка совместимости портов — в условиях.

**6. disconnect_nodes — Удалить связь**
```
E: edge: Edge
C: [workflow.status IN ('draft', 'saved')]
F: [{ α: remove, target: edges, σ: account }]
W: [source.label, target.label]
P: click
```

**7. configure_node — Настроить узел**
```
E: node: Node
C: [workflow.status IN ('draft', 'saved')]
F: [{ α: replace, target: node.config, σ: account }]
W: [node.type, node.config (текущий), configSchema]
P: form
phase: investigation
```
Многофазное: фаза исследования показывает схему конфигурации для данного типа узла. Фаза коммитмента сохраняет конфигурацию.

**8. rename_node — Переименовать узел**
```
E: node: Node
C: []
F: [{ α: replace, target: node.label, σ: account }]
W: [node.label (текущий)]
P: double-click → inline edit
```

**9. save_workflow — Сохранить workflow**
```
E: workflow: Workflow
C: [workflow.status = 'draft']
F: [{ α: replace, target: workflow.status, value: 'saved', σ: account }]
W: [nodes.count, edges.count, validation_errors]
P: click
```
Перед сохранением — валидация: все обязательные порты подключены, нет циклов (если DAG), config заполнен.

**10. delete_workflow — Удалить workflow**
```
E: workflow: Workflow
C: [workflow.status != 'running']
F: [{ α: remove, target: workflows, σ: account }]
W: [workflow.title, nodes.count]
P: click (подтверждение)
irreversibility: high
```

### Исполнение (5)

**11. execute_workflow — Запустить пайплайн**
```
E: workflow: Workflow, execution: Execution
C: [workflow.status = 'saved']
F: [{ α: replace, target: workflow.status, value: 'running', σ: account },
    { α: add, target: executions, σ: account }]
W: [nodes.count, estimated_duration, validation_status]
P: click
creates: Execution(pending)
```
Рабочий процесс исполнения: создаётся Execution, workflow переходит в running. Затем система обходит граф и исполняет узлы по топологическому порядку.

**12. complete_node — Узел завершён (системный)**
```
E: nodeResult: NodeResult
C: [execution_is_running(execution)]
F: [{ α: replace, target: nodeResult.status, value: 'completed', σ: account }]
W: [node.label, output, duration]
P: auto (системный, не пользовательский)
```
Испускается системой при завершении обработки узла. Триггерит запуск следующих узлов по рёбрам.

**13. fail_node — Узел упал (системный)**
```
E: nodeResult: NodeResult
C: [execution_is_running(execution)]
F: [{ α: replace, target: nodeResult.status, value: 'failed', σ: account }]
W: [node.label, error]
P: auto
```

**14. complete_execution — Пайплайн завершён (системный)**
```
E: execution: Execution
C: [execution.status = 'running']
F: [{ α: replace, target: execution.status, value: 'completed', σ: account },
    { α: replace, target: workflow.status, value: 'saved', σ: account }]
W: [duration, results_summary]
P: auto
```

**15. stop_execution — Остановить пайплайн**
```
E: execution: Execution
C: [execution.status = 'running']
F: [{ α: replace, target: execution.status, value: 'failed', σ: account },
    { α: replace, target: workflow.status, value: 'saved', σ: account }]
W: [running_nodes, completed_nodes]
P: click
irreversibility: medium
```

### Расширение (3)

**16. add_custom_node_type — Создать кастомный тип узла**
```
E: nodeType: NodeType
C: []
F: [{ α: add, target: nodeTypes, σ: account }]
W: [existing_types]
P: form
creates: NodeType
```
Пользователь определяет новый тип узла: имя, входы, выходы, схема конфигурации. После создания — доступен в палитре для add_node.

**17. duplicate_workflow — Дублировать workflow**
```
E: workflow: Workflow
C: []
F: [{ α: add, target: workflows, σ: account }]
W: [workflow.title, nodes.count, edges.count]
P: click
creates: Workflow (копия)
```
Расширенное намерение: шаблон `add_node` + `connect_nodes` на коллекции узлов/рёбер оригинала.

**18. import_workflow — Импортировать workflow (JSON)**
```
E: workflow: Workflow
C: []
F: [{ α: add, target: workflows, σ: account }]
W: [json_preview]
P: file upload
creates: Workflow
```
Граница: внешний JSON как источник workflow. Аналог foreign-эффектов.

---

## 4 проекции

**workflow_canvas** `V = ⟨E, Q, W⟩`
```
E: Node, Edge, NodeType
Q: все узлы и рёбра одного workflow с позициями
W: [node.x, node.y, node.type, node.label, node.status, edge.sourceNodeId, edge.targetNodeId]
```
Основная проекция — визуальный canvas. Пространственная: координаты x, y определяют расположение. Узлы рендерятся по типам. Рёбра рисуются кривыми между портами. Цвета по статусу исполнения.

**node_inspector** `V = ⟨E, Q, W⟩`
```
E: Node, NodeType, NodeResult
Q: выбранный узел с конфигурацией и результатом последнего исполнения
W: [label, type, config, configSchema, lastResult.output, lastResult.error]
```
Боковая панель — детали выбранного узла.

**execution_log** `V = ⟨E, Q, W⟩`
```
E: Execution, NodeResult
Q: текущее/последнее исполнение с результатами по узлам
W: [execution.status, nodeResults[], duration, errors]
```
Лог исполнения — прогресс по узлам.

**workflow_list** `V = ⟨E, Q, W⟩`
```
E: Workflow
Q: все workflow
W: [title, status, nodes.count, edges.count, lastExecution]
```

---

## 4 сигнала

**execution_started** — при execute_workflow, at-least-once
**execution_completed** — при complete_execution, at-least-once
**node_failed** — при fail_node, at-least-once (алерт)
**workflow_saved** — при save_workflow, fire-and-forget

---

## Что работает с ходу

**CRUD на узлах и рёбрах.** add_node, remove_node, connect_nodes, disconnect_nodes, configure_node — стандартные намерения с эффектами `add`/`remove`/`replace`. Работает.

**Рабочий процесс workflow.** draft → saved → running → completed/saved. Организатор (автор пайплайна) управляет переходами. Фазы выражаются через условия. Рабочие процессы (раздел 9a) покрывают это.

**Рабочий процесс исполнения.** pending → running → completed/failed по узлам. Топологический обход графа — цепочка причинно-связанных эффектов. Каждый complete_node порождает запуск следующих.

**Антагонисты.** connect ↔ disconnect. save_workflow ↔ (неявный — workflow возвращается в draft при редактировании). Автовывод.

**Проекции.** Canvas, inspector, execution log, list — чистые проекции.

---

## Находки

### W1 (🔴 блокирующая). Пространственные эффекты без семантического смысла.

`move_node` меняет x, y узла. Это эффект, который попадает в Φ, участвует в fold, создаёт причинную цепочку. Но семантически перемещение узла на canvas **не меняет пайплайн**. Два одинаковых пайплайна с разным расположением узлов — функционально идентичны.

Проблема: Φ растёт от каждого drag-end. При 20 узлах и 10 перемещениях каждого — 200 эффектов в Φ только от расположения. Это шум.

Возможные решения:
- **Косметические эффекты как отдельный поток.** Ввести поток `Π` (presentation) параллельный `Φ`, содержащий эффекты на визуальные свойства. Не участвует в семантическом fold, но участвует в проекции canvas.
- **Сжатие**: replace на ту же ячейку (node.x) поглощает предыдущий replace по алгебре (побеждает поздний). Это уже работает, но записи остаются в Φ.
- **Батчинг**: move_node не создаёт эффект на каждый drag, а только на drag-end. Уже предусмотрено (confirmation: drag-end).

Это новая проблема — ни один предыдущий домен не имел чисто визуальных эффектов. **Рекомендация**: зафиксировать как открытое расширение «косметические эффекты».

### W2 (🔴 блокирующая). Обход графа как процесс исполнения.

Исполнение пайплайна — это не одно намерение и не рабочий процесс в смысле раздела 9a. Это **обход графа**: система находит корневые узлы (без входящих рёбер), исполняет их, по завершении — запускает следующие по рёбрам, и так до конца.

Наша модель выражает это как цепочку эффектов: complete_node → (следующие узлы) → complete_node → ... Но **кто управляет обходом**? В текущей архитектуре нет «исполнителя» — нет агента, который обходит граф.

Варианты:
- **Сервер как исполнитель.** execute_workflow → сервер запускает обход, создаёт эффекты complete_node/fail_node по мере исполнения. SSE стримит прогресс.
- **Клиент-управляемый.** Клиент запускает обход, для каждого узла вызывает exec("complete_node"). Проще, но нереалистично (HTTP-запрос нужно делать на сервере).

Это расширение рабочих процессов: процесс, управляемый не пользователем, а **системой** (автоматический обход). Раздел 9a описывает процессы, где разные акторы делают разные переходы. Здесь актор — система, и она делает N переходов автоматически.

**Рекомендация**: ввести концепт **автоматического процесса** — рабочий процесс, где часть переходов выполняется системой (не пользователем) по правилу (топологический обход).

### W3 (🟡 значительная). Рёбра как первоклассные сущности.

В предыдущих доменах связи между сущностями — через поля (booking.slotId, vote.optionId). Здесь Edge — отдельная сущность с собственным ID, создаваемая и удаляемая отдельно.

Модель справляется: Edge — обычная сущность с `add`/`remove`. Но это показывает, что **связи-сущности** (relationship entities из теста 1) — не экзотика, а реальный паттерн. Каскадное удаление (remove_node → remove связанных edges) — правиловой эффект.

Работает без нового концепта, но подтверждает relationship entities как стабильный паттерн.

### W4 (🟡 значительная). Типизированные порты и валидация связей.

`connect_nodes` имеет условие `ports_compatible(source, target)`. Это не обычный предикат на одной сущности — это **предикат на паре сущностей** (два узла с их типами портов).

Наша модель предикатов — на одной сущности (`booking.status = 'confirmed'`). Предикат на связи — расширение. Для прототипа: проверка совместимости в `buildEffects` (не в conditions). Для манифеста: нужны **реляционные предикаты**.

### W5 (🟡 значительная). Конфигурация как вложенный объект.

`configure_node` заменяет `node.config` — а config это объект `{ url, method, headers, body }`. Наш `replace` заменяет значение целиком. Для конфигурации нужно: заменить одно поле внутри объекта без перезаписи остальных.

Варианты:
- `replace node.config.url` — target с глубокой нотацией. Fold должен поддерживать вложенные пути.
- `replace node.config` — заменяем весь объект. Простое, но теряем другие поля при частичном обновлении.

Для прототипа — второй вариант (replace целиком). Для манифеста — зафиксировать как «глубокие пути в target».

### W6 (🟢 минорная). Дублирование workflow как расширенное намерение.

`duplicate_workflow` — это шаблон `add_node` + `connect_nodes` над коллекцией. Расширенное намерение (раздел 9). Работает.

---

## Сводка находок

| # | Находка | Уровень | Тесты |
|---|---|---|---|
| W1 | Косметические/пространственные эффекты — шум в Φ | 🔴 | 6 (новое) |
| W2 | Автоматический процесс (обход графа системой) | 🔴 | 6 (новое) |
| W3 | Рёбра как первоклассные сущности (relationship entities) | 🟡 | 1, 6 |
| W4 | Реляционные предикаты (условие на паре сущностей) | 🟡 | 6 (новое) |
| W5 | Глубокие пути в target (вложенные объекты) | 🟡 | 6 (новое) |
| W6 | Дублирование как расширенное намерение | 🟢 | 3, 6 |

Два блокера. Три значительных. Одна минорная.

---

## Что было подтверждено

- **Рабочие процессы** — workflow lifecycle (draft→saved→running) и execution lifecycle (pending→running→completed). Четвёртый домен.
- **Расширенные намерения** — дублирование workflow как шаблон + коллекция. Третий домен.
- **Каскадное удаление** — remove_node → remove edges. Работает через множественные эффекты.
- **CRUD на графовых структурах** — узлы + рёбра ложатся как обычные сущности.
- **Проекции** — canvas, inspector, log, list — чистые проекции.

---

## Что парадигма НЕ покрывает

1. **Автоматический обход графа.** Исполнение пайплайна — это не одно намерение и не ручной рабочий процесс. Нужен концепт «автоматического процесса» с триггерами.

2. **Косметические эффекты.** Перемещение узла засоряет Φ. Нужен отдельный поток для визуальных свойств.

3. **Реляционные предикаты.** Условие на паре сущностей (совместимость портов) не выражается текущей моделью предикатов.

---

## Траектория блокеров по шести тестам

| Тест | Домен | Тип | 🔴 | 🟡 | 🟢 |
|---|---|---|---|---|---|
| 0.2 | Очередь чтения | персональный | 4 | 5 | 1 |
| 0.2.1 | Календарь | темпоральный | 4 | 4 | 1 |
| 0.2.2 | Интернет-магазин | транзакционный | 2 | 4 | 0 |
| 0.3.1 | Бронирование | транз.-темпоральный | 0 | 4 | 2 |
| 0.5.1 | Совместное планирование | коллаборативный | 2 | 3 | 1 |
| 0.6.1 | Workflow-редактор | графовый/инструм. | 2 | 3 | 1 |

Блокеры: 4→4→2→0→2→2. Кривая стабилизировалась на уровне 2 блокеров для нетранзакционных доменов. Новые блокеры — принципиально новые (пространственные эффекты, автоматические процессы), отсутствовавшие во всех предыдущих доменах.

---

## Вердикт

Workflow-редактор обнаружил два новых блокера, оба фундаментальных: косметические эффекты (разделение семантических и визуальных изменений) и автоматические процессы (обход графа системой). Оба выходят за границы текущей модели и требуют расширения ядра, а не словаря.

Одновременно подтверждено: рабочие процессы, расширенные намерения, каскадные удаления, графовые структуры как сущности. Ядро парадигмы (эффекты, причинность, алгебра, проекции) продолжает работать.

Парадигма честно достигла границы: графовый/инструментальный домен требует расширения модели данных (Π для косметических эффектов) и модели исполнения (автоматические процессы).
