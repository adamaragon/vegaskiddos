import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTransientNetworkError, isTransientNetworkErrorMessage } from "./networkError";

describe("isTransientNetworkErrorMessage", () => {
  it("matches common browser fetch failure wordings", () => {
    assert.equal(isTransientNetworkErrorMessage("network error"), true);
    assert.equal(isTransientNetworkErrorMessage("Failed to fetch"), true);
    assert.equal(isTransientNetworkErrorMessage("Load failed"), true);
    assert.equal(isTransientNetworkErrorMessage("NetworkError when attempting to fetch resource."), true);
  });

  it("ignores real application failures", () => {
    assert.equal(isTransientNetworkErrorMessage("Airtable 401"), false);
    assert.equal(isTransientNetworkErrorMessage("Cannot read properties of undefined"), false);
  });
});

describe("isTransientNetworkError", () => {
  it("detects TypeError network failures", () => {
    assert.equal(isTransientNetworkError(new TypeError("network error")), true);
    assert.equal(isTransientNetworkError(new TypeError("Failed to fetch")), true);
  });

  it("detects NetworkError DOMExceptions", () => {
    assert.equal(isTransientNetworkError({ name: "NetworkError", message: "boom" }), true);
  });

  it("ignores unrelated errors", () => {
    assert.equal(isTransientNetworkError(new Error("Airtable 500")), false);
    assert.equal(isTransientNetworkError(null), false);
  });
});
