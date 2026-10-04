import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist/client";
const index = join(dir, "index.html");

if (!existsSync(index)) {
  console.error("index.html não encontrado em dist/client. O build estático não gerou a página principal.");
  process.exit(1);
}

copyFileSync(index, join(dir, "404.html"));
writeFileSync(join(dir, ".nojekyll"), "");
console.log("GitHub Pages: dist/client/index.html, 404.html e .nojekyll prontos.");
