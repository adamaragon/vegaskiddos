import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// ISR / data cache persisted in R2 (bucket bound as NEXT_INC_CACHE_R2_BUCKET in
// wrangler.jsonc) so cached pages survive across deploys, instead of the
// default in-worker cache that resets each deploy.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
