# 验证记录

此文件记录本包的实际检查范围，不承诺所有模型或宿主上的确定行为。

## 检查类型

- `npm test`：元数据、五个手动入口、skill-local 链接、日期产出契约和分发内容。
- `npm pack --dry-run --json`：确认安装包资源完整且不包含 `example/`、`.pi/` 或会话文件。
- `git diff --check`：检查变更空白错误。
- `tests/check_pi.py`：在隔离配置与本地假模型中检查 plugin/skill 加载、自动发现隐藏、参数传递、绝对 skill 路径和相对引用基准。
- [行为场景](../tests/scenarios.md)：模型/宿主评估输入与判据，不是静态测试的通过证明。

## 当前重构

当前架构为五个显式入口：

```text
ic-research → ic-prepare → ic-design-review → ic-do → ic-code-review
```

各入口不自动互调。随包资源相对 skill 目录解析；业务项目的 `docs/...` 持久产出相对目标业务项目根目录，默认是调用时工作目录，不写入 skill 安装目录。是否落盘由 Agent 按产出价值判断：实质、可复用、可交接的研究、准备、审查和执行结果默认落盘，短答或用户明确禁止写文件时只回复；用户补充或新证据出现时更新原文件对应章节，不机械追加。持久产出按主产出和阶段归档：

```text
docs/ic-research/YYYY-MM-DD-<topic>.md
docs/ic-prepare/YYYY-MM-DD-<topic>.md
docs/ic-design-review/YYYY-MM-DD-<topic>.md
docs/ic-do/YYYY-MM-DD-<topic>.md
docs/ic-code-review/YYYY-MM-DD-<topic>.md
```

`ic-prepare` 每次先选一个主产出；产品地图、需求、UI、Design、原型和 Plan 只按需组合，用户明确要求组合时也不填空。UI 规则吸收当前/目标/示意、关键状态、动态空间边界和原型/规格分离。`ic-design-review` 只审开发前准备，`ic-code-review` 只审开发后代码与证据。

## 已执行检查

以下结果对应本次五入口和日期契约重构：

- `npm test`：通过；5 个手动 skill、严格日期产出路径契约、自适应落盘契约、40 个场景定义、19 个分发文件。测试还要求 `ic-do` 记录版本/工作区快照，`ic-code-review` 核对执行证据与版本并允许仅更新自身审查报告。
- 日期产出路径负向检查：在隔离副本中移除 `YYYY-MM-DD-<topic>.md` 后，`npm test` 按预期失败。
- `npm pack --dry-run --json --ignore-scripts`：通过；静态白名单一致。
- `git diff --check`：通过。
- `python3 tests/check_pi.py`：Pi 0.84.4 通过，16 个本地假模型请求，验证五个原生入口和五个 plugin 入口。
- `python3 tests/check_pi.py --plugin-only`：Pi 0.84.4 通过，11 个本地假模型请求，关闭 skill 命令时验证五个 plugin 入口。
- Pi 官方 `docs/skills.md` 说明 `disable-model-invocation: true` 会将 skill 隐藏出 system prompt，用户仍可用 `/skill:name` 调用；本项目的 Pi 检查也实际验证了五个目标 skill 不在 system prompt、阳性对照仍可见。该结论限定于 Pi 0.84.4，其他 Pi 版本和宿主未验证。
- S34–S41：覆盖五入口产出、主产出选择、显式交接、自适应落盘、原位更新、测试和不自动串联；尚未进行真实模型评估。

## 局限

静态检查不证明模型会遵守 skill；Pi 假模型只证明宿主请求传递和入口加载，不证明真实模型的研究、产品设计、审查或编码质量。未运行、工具不可用、无法访问外部资料或只做静态分析的内容必须在对应产出中标明。
