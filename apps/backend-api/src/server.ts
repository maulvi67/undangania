import { createServer } from "node:http";
const server = createServer((req, res) => { if (req.url === "/health") { res.writeHead(200,{"content-type":"application/json"}); return res.end(JSON.stringify({status:"ok"})); } res.writeHead(404); res.end(); });
server.listen(process.env.PORT ?? 4000);
