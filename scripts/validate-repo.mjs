import fs from "node:fs";
const required=["AGENTS.md","PROJECT_CONTEXT.md",".mcp.json",".agents/orchestrator.md",".skills/ui-ux-brief/SKILL.md",".skills/ui-quality-gate/SKILL.md",".claude/rules/01-ui-ux.md",".ai/tasks/TASK_TEMPLATE.md","apps/web/src/app/page.tsx"];
const missing=required.filter(p=>!fs.existsSync(p)||fs.statSync(p).size===0);if(missing.length){console.error(missing);process.exit(1)};JSON.parse(fs.readFileSync(".mcp.json","utf8"));console.log(`Repository validation passed: ${required.length} required artifacts.`);
