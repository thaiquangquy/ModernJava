// Local dev server: mdBook (live reload) + a Java runner on the same origin.
//
//   node dev/serve.mjs            # http://localhost:3000
//   PORT=4000 MDBOOK=/path/to/mdbook JAVA_HOME=/path/to/jdk25 node dev/serve.mjs
//
// The theme posts to a relative "../_runner/execute", so in production nginx
// proxies /_runner/ to the sandboxed runner. Here this script plays nginx:
//   POST /_runner/execute -> compile and run with the local JDK
//   everything else       -> proxied to `mdbook serve` (HTTP + live-reload websocket)
// The local runner is NOT sandboxed. It is for development on your own machine only.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT || 3000);
const MDBOOK_PORT = Number(process.env.MDBOOK_PORT || PORT + 1);
const MDBOOK = process.env.MDBOOK || "mdbook";
const JAVA = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";
const TIMEOUT_MS = 10_000;
const MAX_OUTPUT = 64 * 1024;

const mdbook = spawn(MDBOOK, ["serve", "-p", String(MDBOOK_PORT), "-n", "127.0.0.1"], { stdio: "inherit" });
mdbook.on("error", (e) => { console.error(`Cannot start ${MDBOOK}: ${e.message}`); process.exit(1); });
mdbook.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { mdbook.kill(); process.exit(0); });

async function runJava(code) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "modernjava-run-"));
    const file = path.join(dir, "Main.java");
    await fs.writeFile(file, code);
    try {
        return await new Promise((resolve) => {
            const child = spawn(JAVA, [file], {
                cwd: dir,
                stdio: ["ignore", "pipe", "pipe"],
            });
            let stdout = "", stderr = "", done = false;
            const append = (s, chunk) => (s.length < MAX_OUTPUT ? s + chunk : s);
            child.stdout.on("data", (c) => (stdout = append(stdout, c)));
            child.stderr.on("data", (c) => (stderr = append(stderr, c)));
            const finish = (success, extra = "") => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve({ success, stdout, stderr: stderr + extra });
            };
            const timer = setTimeout(() => { child.kill("SIGKILL"); finish(false, `\nTimed out after ${TIMEOUT_MS / 1000}s`); }, TIMEOUT_MS);
            child.on("error", (e) => finish(false, `Cannot start java: ${e.message}`));
            child.on("close", (exit) => finish(exit === 0));
        });
    } finally {
        fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
}

const server = http.createServer(async (req, res) => {
    if (req.url.split("?")[0] === "/_runner/execute") {
        if (req.method !== "POST") { res.writeHead(405).end(); return; }
        let body = "";
        for await (const chunk of req) body += chunk;
        let payload;
        try { payload = JSON.parse(body); } catch { res.writeHead(400).end("bad json"); return; }
        const result = await runJava(String(payload.code ?? ""));
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
        return;
    }
    const proxy = http.request(
        { host: "127.0.0.1", port: MDBOOK_PORT, path: req.url, method: req.method, headers: req.headers },
        (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); },
    );
    proxy.on("error", () => res.writeHead(502).end("mdbook not ready yet, retry in a moment"));
    req.pipe(proxy);
});

// Live-reload websocket: tunnel the raw upgrade to mdbook.
server.on("upgrade", (req, socket, head) => {
    const up = net.connect(MDBOOK_PORT, "127.0.0.1", () => {
        up.write(`${req.method} ${req.url} HTTP/1.1\r\n` +
            Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n");
        up.write(head);
        socket.pipe(up).pipe(socket);
    });
    up.on("error", () => socket.destroy());
    socket.on("error", () => up.destroy());
});

server.listen(PORT, () => console.log(`Dev server with Java runner: http://localhost:${PORT}  (mdbook on ${MDBOOK_PORT}, java: ${JAVA})`));
