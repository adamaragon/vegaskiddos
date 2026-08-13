import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "crypto";
import { unsubToken, unsubTokenOk } from "./unsubToken";

const BASE = "appJu8YZ63WNHMPhF";

function withSecret(value: string | undefined, fn: () => void) {
  const saved = process.env.AUTH_SECRET;
  if (value === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  }
}

describe("unsubToken", () => {
  it("accepts the HMAC token it just minted", () => {
    withSecret(undefined, () => {
      const t = unsubToken("AdaM@example.com", BASE);
      assert.equal(t.length, 64);
      assert.equal(unsubTokenOk("adam@example.com", BASE, t), true);
    });
  });

  it("mints with AUTH_SECRET when set, and still accepts a base-id HMAC", () => {
    withSecret("unit-test-secret", () => {
      const t = unsubToken("adam@example.com", BASE);
      assert.equal(unsubTokenOk("adam@example.com", BASE, t), true);
      const baseTok = createHmac("sha256", BASE).update("adam@example.com").digest("hex");
      assert.equal(unsubTokenOk("adam@example.com", BASE, baseTok), true);
      assert.notEqual(t, baseTok);
    });
  });

  it("still accepts the old 16-char sha256 slice so existing email links work", () => {
    withSecret(undefined, () => {
      const legacy = createHash("sha256")
        .update("adam@example.com" + BASE)
        .digest("hex")
        .slice(0, 16);
      assert.equal(unsubTokenOk("adam@example.com", BASE, legacy), true);
    });
  });

  it("rejects a guess", () => {
    withSecret(undefined, () => {
      assert.equal(unsubTokenOk("adam@example.com", BASE, "deadbeef"), false);
      assert.equal(unsubTokenOk("adam@example.com", BASE, ""), false);
    });
  });
});
