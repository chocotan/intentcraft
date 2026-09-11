import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = {
	intentcraft: new URL("../skills/intentcraft/SKILL.md", import.meta.url),
	"intentcraft-review": new URL("../skills/intentcraft-review/SKILL.md", import.meta.url),
} as const;

export default function (pi: ExtensionAPI) {
	for (const [name, url] of Object.entries(SKILLS)) {
		pi.registerCommand(name, {
			description: name === "intentcraft"
				? "研究、讨论、需求收敛与实施规划"
				: "独立只读审查研究、需求与实施计划",
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
