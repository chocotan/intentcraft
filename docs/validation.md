# 验证记录

此文件记录本包的实际检查范围，不承诺所有模型或宿主上的确定行为。

## 检查类型

- `npm test`：元数据、四个手动入口、skill-local 链接、文档归档目录、规则标记和分发内容检查。
- `npm pack --dry-run --json`：确认安装包包含维护资源，不包含 `example/`、`.pi/` 或会话文件。
- `git diff --check`：检查当前变更的空白错误。
- `tests/check_pi.py`：在隔离配置与本地假模型中检查 plugin/skill 加载、自动发现隐藏、参数传递、绝对 skill 路径和相对引用基准。
- [行为场景](../tests/scenarios.md)：模型/宿主评估输入与判据，不是静态测试的通过证明。

## ic-* 结构重构

### 目标

入口从旧的 `intentcraft` / `intentcraft-review` 重构为四个显式 `ic-*` skill：

```text
ic-research → ic-prepare → ic-review → ic-do
```

四者不自动互调。研究、准备、审查和实现分别拥有独立授权与完成标准；需要保存文档时分别归档到：

```text
docs/ic-research/
docs/ic-prepare/
docs/ic-review/
docs/ic-do/
```

`ic-prepare` 吸收产品地图、功能/用户旅程、UI 契约、Design 和实施计划；UI 契约借鉴 CodeStable-Lite 的当前/目标/示意、关键状态、空间边界和原型/规格分离。整体边界沿用完整 CodeStable v2 的按需加载、事实与产品决策分离、风险相称和一个事实一个归宿原则。

### 实际检查

- `npm test`：通过；4 个手动 skill、4 个文档归档路径、38 个场景定义和 18 个分发文件。
- `npm pack --dry-run --json --ignore-scripts`：通过；包内容与静态白名单一致，不含 `example/`、`.pi/` 或 `.agents/`。
- `git diff --check`：通过。
- `python3 tests/check_pi.py`：通过；Pi 0.84.4，13 个本地假模型请求，验证四个原生入口与四个 plugin 入口。
- `python3 tests/check_pi.py --plugin-only`：通过；Pi 0.84.4，9 个本地假模型请求，关闭 skill 命令时仅验证四个 plugin 入口。
- S34–S38：已加入产出契约、显式交接、测试和不自动串联场景，尚未进行真实模型评估。

### 局限

静态检查不证明模型会遵守 skill；Pi 假模型只证明宿主请求传递和入口加载，不证明真实模型的研究、产品设计、审查或编码质量。未运行、工具不可用、无法访问外部资料或只做静态分析的内容必须在对应产出中标明。
