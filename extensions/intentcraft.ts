import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = {
	"ic-research": new URL("../skills/ic-research/SKILL.md", import.meta.url),
	"ic-prepare": new URL("../skills/ic-prepare/SKILL.md", import.meta.url),
	"ic-do": new URL("../skills/ic-do/SKILL.md", import.meta.url),
	"ic-code-review": new URL("../skills/ic-code-review/SKILL.md", import.meta.url),
} as const;

function descriptionFrom(skill: string, fallback: string) {
	const match = skill.match(/^description: ("(?:[^"\\]|\\.)*"|.+)$/m);
	if (!match) return fallback;
	return match[1].startsWith('"') ? JSON.parse(match[1]) : match[1];
}

export default function (pi: ExtensionAPI) {
	for (const [name, url] of Object.entries(SKILLS)) {
		const skillPath = fileURLToPath(url);
		const skill = readFileSync(skillPath, "utf8");
		const description = descriptionFrom(skill, name);
		pi.registerCommand(name, {
			description,
			handler: async (args, ctx) => {
				const projectRoot = process.cwd();
				const instructions = `用户显式启动 ${name}。\nSkill 文件：${skillPath}\n随包资源中的相对引用以 ${dirname(skillPath)} 为基准解析；业务项目产出路径以目标业务项目根目录为基准，默认是调用时工作目录 ${projectRoot}，不写入 skill 安装目录。\n\n${skill}`;
				const request = args.trim();
				const message = request ? `${instructions}\n\nUser: ${request}` : instructions;

				if (ctx.isIdle()) pi.sendUserMessage(message);
				else pi.sendUserMessage(message, { deliverAs: "followUp" });
			},
		});
	}
}
