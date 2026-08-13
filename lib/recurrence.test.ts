import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventHasEnded, isListedEvent, recursOnDay } from "./recurrence";

describe("eventHasEnded", () => {
  it("keeps recurring series live even when the stored start is in the past", () => {
    assert.equal(eventHasEnded("2026-06-10T19:00:00.000Z", "Weekly on Wednesdays", new Date("2026-08-12T12:00:00Z")), false);
  });

  it("marks a one-time event ended after its start", () => {
    assert.equal(eventHasEnded("2026-07-15T22:30:00.000Z", undefined, new Date("2026-08-12T12:00:00Z")), true);
    assert.equal(eventHasEnded("2026-08-20T22:30:00.000Z", undefined, new Date("2026-08-12T12:00:00Z")), false);
  });
});

describe("isListedEvent", () => {
  const now = new Date("2026-08-12T12:00:00Z");

  it("keeps recurring series on the listing regardless of stored start", () => {
    assert.equal(isListedEvent({ start: "2026-06-10T19:00:00.000Z", recurrence: "Weekly on Wednesdays" }, now), true);
  });

  it("keeps a one-time event on the listing for about a day after start", () => {
    assert.equal(isListedEvent({ start: "2026-08-12T02:00:00.000Z" }, now), true);
    assert.equal(isListedEvent({ start: "2026-08-10T12:00:00.000Z" }, now), false);
  });
});

describe("recursOnDay (Los Angeles civil weekday)", () => {
  it("treats Friday 6pm PT as Friday even when that instant is Saturday UTC", () => {
    // Friday 14 Aug 2026 18:00 PDT = 2026-08-15T01:00:00.000Z (Saturday UTC)
    const start = "2026-08-15T01:00:00.000Z";
    assert.equal(recursOnDay(start, "Weekly on Fridays", 2026, 7, 14), true);
    assert.equal(recursOnDay(start, "Weekly on Fridays", 2026, 7, 15), false);
  });
});
