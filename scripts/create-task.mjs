import fs from "node:fs";
const id = process.argv[2];
if (!id) throw new Error("Usage: node scripts/create-task.mjs TASK-ID");
const template = fs.readFileSync(".ai/tasks/TASK_TEMPLATE.md", "utf8");
const target = `.ai/tasks/${id}.md`;
if (fs.existsSync(target)) throw new Error("Task exists");
fs.writeFileSync(target, template.replace("<TASK-ID>", id));
console.log(target);
