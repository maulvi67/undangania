import fs from "node:fs"; import path from "node:path";
const root=process.cwd(); const required=["README.md","AGENTS.md","CLAUDE.md","PROJECT_CONTEXT.md","PRODUCT_REQUIREMENTS.md","ARCHITECTURE.md","packages/database/prisma/schema.prisma",".agents/orchestrator-agent.md",".skills/understand-codebase/SKILL.md",".ai/tasks/TASK_TEMPLATE.md"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p))); if(missing.length){console.error("Missing required files",missing);process.exit(1)}
const jsonFiles=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==="node_modules"||e.name.startsWith("."))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith(".json"))jsonFiles.push(p)}}; walk(root); for(const f of jsonFiles)JSON.parse(fs.readFileSync(f,"utf8"));
console.log(`Repository validation passed: ${required.length} required files, ${jsonFiles.length} JSON files.`);
