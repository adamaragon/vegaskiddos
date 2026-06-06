import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare pilot config. No R2 incremental cache yet — pages use the default
// in-worker cache, which is fine for evaluating the deploy. For production ISR
// persistence across deploys, create an R2 bucket, bind it in wrangler.jsonc as
// NEXT_INC_CACHE_R2_BUCKET, and switch to the R2 override:
//
//   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
//   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
export default defineCloudflareConfig({});
