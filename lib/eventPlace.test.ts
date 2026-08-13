import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cardPlaceLabel, firstStreetFromText } from "./eventPlace";

const base = { venue: "", address: "", description: "" };

describe("firstStreetFromText", () => {
  it("pulls a trailing-direction Vegas boulevard out of a sentence", () => {
    assert.equal(
      firstStreetFromText(
        "Located at 900 Las Vegas Blvd N in the Henderson/Las Vegas area, this exhibit offers displays.",
      ),
      "900 Las Vegas Blvd N",
    );
  });

  it("pulls a leading-direction street", () => {
    assert.equal(
      firstStreetFromText("held at 27 S Stephanie St in Henderson. This gathering offers fun."),
      "27 S Stephanie St",
    );
  });

  it("pulls a multi-word Drive", () => {
    assert.equal(
      firstStreetFromText("Located at 4215 S Grand Canyon Drive in the Henderson/Las Vegas area."),
      "4215 S Grand Canyon Drive",
    );
  });

  it("keeps Suite on Parkway", () => {
    assert.equal(
      firstStreetFromText("WomensCare/Outreach Center 2651 Paseo Verde Parkway Suite 180 702.616.4901"),
      "2651 Paseo Verde Parkway Suite 180",
    );
  });

  it("does not return the whole blurb", () => {
    const blurb =
      "Explore the fascinating world of arachnids at the Art & Science of Arachnids Traveling Exhibit. Located at 900 Las Vegas Blvd N in the Henderson/Las Vegas area, this exhibit offers a unique opportunity for families to learn about these incredible creatures through engaging displays and interactive experiences.";
    const got = firstStreetFromText(blurb);
    assert.equal(got, "900 Las Vegas Blvd N");
    assert.ok(got.length < 40);
    assert.ok(!got.includes("fascinating"));
  });

  it("returns empty when there is no street", () => {
    assert.equal(firstStreetFromText("A free storytime for ages 3-12 at 10 a.m. Join us!"), "");
  });
});

describe("cardPlaceLabel", () => {
  it("prefers venue over address and description", () => {
    assert.equal(
      cardPlaceLabel({
        ...base,
        venue: "Las Vegas Natural History Museum",
        address: "900 Las Vegas Blvd N, Las Vegas, NV 89101",
        description: "Located at 900 Las Vegas Blvd N in the area.",
      }),
      "Las Vegas Natural History Museum",
    );
  });

  it("uses address when venue is empty", () => {
    assert.equal(
      cardPlaceLabel({
        ...base,
        address: "1771 Inner Circle Dr, Las Vegas, NV 89134",
        description: "Located at 900 Las Vegas Blvd N.",
      }),
      "1771 Inner Circle Dr, Las Vegas, NV 89134",
    );
  });

  it("parses description when venue and address are empty", () => {
    assert.equal(
      cardPlaceLabel({
        ...base,
        description:
          "Explore the fascinating world of arachnids at the Art & Science of Arachnids Traveling Exhibit. Located at 900 Las Vegas Blvd N in the Henderson/Las Vegas area, this exhibit offers a unique opportunity for families.",
      }),
      "900 Las Vegas Blvd N",
    );
  });

  it("extracts a street from a dumped multi-line address field", () => {
    assert.equal(
      cardPlaceLabel({
        ...base,
        address:
          "WomensCare/Outreach Center\n2651 Paseo Verde Parkway Suite 180\nAnd also another site across town with a long paragraph that should not appear.",
      }),
      "2651 Paseo Verde Parkway Suite 180",
    );
  });

  it("returns empty when nothing street-like exists", () => {
    assert.equal(
      cardPlaceLabel({
        ...base,
        description: "A delightful indoor play morning for toddlers and their grown-ups.",
      }),
      "",
    );
  });
});
