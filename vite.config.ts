import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vitest/config";

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function jsonSavePlugin(route: string, relativePath: string): Plugin {
  const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
  return {
    name: `json-save:${route}`,
    configureServer(server) {
      server.middlewares.use(route, (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        void (async () => {
          try {
            const text = await collectBody(req);
            JSON.parse(text);
            fs.writeFileSync(filePath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
            res.statusCode = 204;
            res.end();
          } catch (error) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(error instanceof Error ? error.message : "save failed");
          }
        })();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    jsonSavePlugin("/__wave-table", "./src/core/waves.json"),
    jsonSavePlugin("/__enemy-table", "./src/core/enemies.json"),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["src/core/**/*.test.ts"],
  },
});
