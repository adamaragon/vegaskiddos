import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { artTypeFor } from "./eventArt";

function typeId(title: string, description = "") {
  return artTypeFor(title, description).id;
}

describe("artTypeFor", () => {
  it("classifies Kids Cafe as food, not gaming, even when the blurb mentions teens", () => {
    const desc =
      "We're excited to partner with Three Square to offer free, nutritious meals for children and teens ages 3-18!";
    assert.equal(typeId("Kids Cafe | North Las Vegas", desc), "food");
    assert.equal(typeId("Kids Cafe at Aliante Library", desc), "food");
    assert.equal(typeId("Kids Cafe", "Join Enterprise Library for free meals. Food is provided by Three Square."), "food");
  });

  it("classifies mom/child yoga as yoga, not baby, storytime, or gaming", () => {
    assert.equal(
      typeId(
        "Mom and Baby Yoga",
        "Mommy & Baby Yoga. A class for new mommies with infants. Post-natal yoga helps mommy regain strength.",
      ),
      "yoga",
    );
    assert.equal(
      typeId(
        "Mommy & Toddler Yoga",
        "Get ready to dance, read books, listen to some of your child's favorite songs all while learning yoga!",
      ),
      "yoga",
    );
    assert.equal(typeId("Preschool Yoga at the Library", "Join us for this free kids' yoga class."), "yoga");
  });

  it("classifies farmers markets as market, not nature or storytime", () => {
    assert.equal(
      typeId(
        "Farmer's Market Capriola Park",
        "Capriola Park MARKET OPERATES: June, July and August FREQUENCY: Every Thursday",
      ),
      "market",
    );
    assert.equal(
      typeId("Henderson Farmers Market", "Visit the Henderson Farmers Market for fresh produce, local crafts, and live music."),
      "market",
    );
  });

  it("does not treat 'teens' in a meal blurb or 'Teen Arts' as video games", () => {
    assert.equal(typeId("Teen Arts & Crafts: Self Portraits", "Come and paint your own self portrait on canvas."), "art");
    assert.equal(typeId("Friday Game Day at Clark County Library", "Board games and video games for teens."), "gaming");
  });

  it("classifies Art Market as art (title art beats generic market)", () => {
    assert.equal(typeId("Art Market at The UnCommons"), "art");
  });

  it("classifies board-game nights as boardgame, not video games", () => {
    assert.equal(typeId("Family Board Game Night", "Bring your favorite board games."), "boardgame");
    assert.equal(typeId("Chess Club at the Library"), "boardgame");
  });

  it("does not treat West Side Story as storytime", () => {
    assert.equal(typeId("West Side Story", "A stage musical for families."), "theater");
  });

  it("does not treat document.ready scrape junk as storytime", () => {
    assert.equal(
      typeId(
        "Farmer's Market at Cornerstone Park",
        "Sponsors ( window.advanced_ads_ready || jQuery( document ).ready ).call( null, function() {",
      ),
      "market",
    );
  });
});
