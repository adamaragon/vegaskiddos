import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2-backed incremental cache: ISR/SSR responses persist across deploys in the
// vegaskiddos-cache bucket (bound as NEXT_INC_CACHE_R2_BUCKET in wrangler.jsonc).
// Critical for cost/CPU: without it, every request is a full SSR re-render,
// which spiked CPU and triggered error 1102 during cutover attempt #1.
export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
