// Thin wrapper — delegates to the TypeScript CLI (shared with lib/scrape/run.ts).
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "fill-blank-descriptions-cli.ts");
const r = spawnSync("npx", ["tsx", cli, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
