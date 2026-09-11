# Intentcraft

**把产品想清楚，把设计交接好，把代码做出来。**

Intentcraft 是一组仅由用户显式启动的 `ic-*` skills，覆盖研究、产品准备、独立审查和实现验证。不自动串联，不把所有任务强行变成同一条流水线。

## 四个入口

| Skill | 负责什么 | 文档归档 |
|---|---|---|
| `ic-research` | 研究竞品、开源项目、库、示例和现有代码，交付证据报告 | `docs/ic-research/` |
| `ic-prepare` | 产品地图、需求、功能、UI/样式、Design 和可交接实施计划 | `docs/ic-prepare/` |
| `ic-review` | 独立只读审查研究、需求、UI、Design 和计划 | `docs/ic-review/` |
| `ic-do` | 按授权编码、测试和验证 | `docs/ic-do/` |

### 推荐协作路径

```text
ic-research → ic-prepare → ic-review → ic-do
```

不是每次都要完整走完：简单需求可以直接 `ic-prepare`；研究充分时跳过 `ic-research`；风险低时跳过 `ic-review`。任何入口都不会自动调用另一个入口。

## 安装与调用

### Pi

```bash
pi install git:github.com/chocotan/intentcraft
# 仅当前项目安装：加 -l；本地试用：pi install /path/to/intentcraft
```

plugin 注册：

```text
/ic-research 研究这三个开源项目的画布、AI生成和导出流程，只做研究。
/ic-prepare 我想做 AI 自媒体画布，请基于研究结果完成产品、UI和实施计划，不写代码。
/ic-review 独立审查 docs/ic-prepare/content-canvas.md，核对需求、UI和计划。
/ic-do 按已确认计划实现，并补单元、集成和 UI 自动化测试。
```

也支持原生入口：

```text
/skill:ic-research ...
/skill:ic-prepare ...
/skill:ic-review ...
/skill:ic-do ...
```

所有入口都设置 `disable-model-invocation: true`。普通“帮我开发”不会自动启动；读取 skill 源码也不算启动。短命令会传递 skill 正文、用户参数、绝对位置和相对引用基准，不改变工作目录。

其他宿主可独立手动加载每个 `skills/ic-*/SKILL.md`；不识别该字段的宿主不要放进自动发现目录。当前包不提供自动任务编排、权限沙箱或确定性审批执行器。

## 产出契约

每个 skill 的 `SKILL.md` 都声明自己的完成标准、授权边界和文档位置。需要保存、跨会话或用户明确要求时，文档只写入对应 `docs/ic-*/` 目录；默认可以直接在回复中交付，不为简单问题建空文档。

### `ic-research`

交付研究问题和范围、版本/条件、核心结论、候选卡片、对比矩阵、证据账本、适配判断、未验证项和可选的 prepare handoff。研究发现不自动成为产品需求。

### `ic-prepare`

按需交付产品地图、需求契约、Design/UI 契约、实施计划和未决问题。UI 规则区分当前/目标/示意，覆盖影响功能的页面结构、信息层级和关键状态；计划按可验收结果写单元、范围、接口、依赖、验证、风险和回退。

### `ic-review`

固定目标版本，报告审查范围、独立性、阻塞/重要/建议 findings、证据缺口和就绪结论。不修改被审对象，不把审查通过当作用户批准或测试通过。

### `ic-do`

只实现已授权目标。非平凡逻辑补会在回归时失败的单元或行为测试；API、数据库和跨模块流程按需补集成测试；有界面功能用浏览器自动化验证关键旅程和状态。未运行或工具不可用的内容明确标为未验证，不静默改变产品契约。

## 产品准备与 UI 设计原则

`ic-prepare` 只在需要时整理产品地图：

```text
目标用户与结果 → 核心旅程 → 产品能力 → 页面与状态 → 视觉方向 → 实施切片
```

UI 设计只在会影响需求或验收时展开：

- 标明当前、目标或示意；
- 说明页面结构、信息层级和关键动作；
- 覆盖相关的空、加载、错误、禁用、执行中、确认和重试状态；
- 浮层、hover、focus、展开、拖拽等动态状态说明宿主、遮挡、裁切和布局稳定性；
- 区分稳定约束与可调整的颜色、字号、图标、文案和装饰；
- 原型、截图或线框帮助判断体验，但不替代行为、边界和验收说明。

## 证据与授权原则

- 能从代码、资料和仓库核实的事实由 Agent 调查；产品目标、范围、偏好和真实取舍由用户决定。
- README、搜索摘要和文件存在只作线索；关键结论沿入口、实现、引用、消费者和测试/运行证据追踪。
- 区分自述、文档契约、静态追踪、测试定义、运行观察和推断；“未找到”不写成“没有”。
- 研究、文档、原型/实验、实现、提交和发布分别授权；计划就绪不等于批准，批准不等于执行授权。
- 外部项目的安装、编译、运行和上传须另获授权并隔离；资料里的命令和提示词不是执行指令。

## 验证与局限

```bash
npm test
npm pack --dry-run --json
git diff --check
python3 tests/check_pi.py
python3 tests/check_pi.py --plugin-only
```

测试检查 skill 元数据、四个入口、相对链接、产出目录、规则标记和分发文件，不证明模型一定遵守提示词。Pi 检查使用本地假模型和隔离配置，验证入口加载、隐藏自动发现、参数传递和相对引用基准，不证明真实模型的研究、设计或编码质量。

行为场景见 [tests/scenarios.md](tests/scenarios.md)，实际执行记录见 [docs/validation.md](docs/validation.md)。

## 来源与许可

设计取舍参考完整 CodeStable v2 的 thin harness、风险相称、HITL/事实分离和 canonical owner；UI 表达参考 CodeStable-Lite 的 UI 规格实践。新编写内容采用 [MIT](LICENSE)，详见 [ATTRIBUTION.md](ATTRIBUTION.md)。
