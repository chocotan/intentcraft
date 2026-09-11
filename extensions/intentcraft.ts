import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = {
	"ic-research": new URL("../skills/ic-research/SKILL.md", import.meta.url),
	"ic-prepare": new URL("../skills/ic-prepare/SKILL.md", import.meta.url),
	"ic-review": new URL("../skills/ic-review/SKILL.md", import.meta.url),
	"ic-do": new URL("../skills/ic-do/SKILL.md", import.meta.url),
} as const;

const DESCRIPTIONS = {
	"ic-research": "证据研究、竞品与开源项目分析",
	"ic-prepare": "产品、需求、UI设计与实施计划",
	"ic-review": "独立只读审查研究与准备成果",
	"ic-do": "按授权编码、测试与验证",
} as const;

export default function (pi: ExtensionAPI) {
	for (const [name, url] of Object.entries(SKILLS)) {
		pi.registerCommand(name, {
			description: DESCRIPTIONS[name as keyof typeof DESCRIPTIONS],
			handler: async (args, ctx) => {
				const skillPath = fileURLToPath(url);
				const skill = readFileSync(skillPath, "utf8");
				const instructions = `用户显式启动 ${name}。\nSkill 文件：${skillPath}\n正文中的相对引用以 ${dirname(skillPath)} 为基准解析，不以当前项目工作目录为基准。\n\n${skill}`;
				const request = args.trim();
				const message = request ? `${instructions}\n\nUser: ${request}` : instructions;

				if (ctx.isIdle()) {
					pi.sendUserMessage(message);
				} else {
					pi.sendUserMessage(message, { deliverAs: "followUp" });
				}
			},
		});
	}
}
