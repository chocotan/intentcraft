# Working on Intentcraft

- 用简洁中文写面向人的回复、报告和文档；代码、路径、协议 key 保持原格式。
- 维护五个仅由用户显式调用的 skill：`ic-research`、`ic-prepare`、`ic-design-review`、`ic-do`、`ic-code-review`；不建立自动生命周期引擎。
- 每个 `SKILL.md` 保留 `disable-model-invocation: true` 和明确启动边界；skill 不自动调用下一个 skill。
- `ic-research` 只做有界证据研究；`ic-prepare` 负责产品/需求/UI/Design/Plan；`ic-design-review` 只审开发前准备；`ic-do` 负责授权实现和验证；`ic-code-review` 只审代码变更和测试证据。
- 每个调用先选当前 skill 的主产出；不因调用 `ic-prepare` 自动生成全套产品、UI、Design 和计划，用户明确要求组合时也不填空或扩大授权。
- 阶段文档只能写入对应 `docs/ic-*/YYYY-MM-DD-<topic>.md`；同一主题同一阶段原位更新，独立的新阶段或新快照才新建文件。代码与测试遵循目标项目结构，不受报告路径限制。
- 事实由 agent 核实，产品取舍由用户决定；区分自述、文档契约、静态追踪、测试定义、运行观察和推断。“未找到”不写成“没有”。
- 非平凡实现要有相称测试；有界面功能覆盖关键用户旅程和状态的浏览器自动化。未运行或工具不可用必须标明，不把静态提示词检查写成运行保障。
- `ic-design-review`、`ic-code-review` 只读；发现问题交回对应 skill，不自动修复、提交或发布。
- 本仓库不维护 skill 提示词测试套件；交付前检查 `npm pack --dry-run --json --ignore-scripts` 的分发内容及 `git diff --check`，通过实际会话判断提示词效果。
- 不暂存或发布 `example/`、`.pi/`、凭据和会话文件；优先原生能力、已有工具和最小实现。
