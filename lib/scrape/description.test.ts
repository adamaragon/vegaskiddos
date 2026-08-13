import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeDescription,
  looksLikeCode,
  fallbackDescription,
  stripMarkup,
} from "./sanitize-description.mjs";

const FFV_CORNERSTONE =
  'Sponsors ( window.advanced_ads_ready || jQuery( document ).ready ).call( null, function() {var $familslider1904943259 = jQuery( ".famil-slider-1904943259" );$familslider1904943259.on( "unslider.ready", function() { jQuery( "div.custom-slider ul li" ).css( "display", "block" ); });$familslider1904943259.unslider({ delay:8000, autoplay:true, nav:false, arrows:false, infinite:true });$familslider1904943259.on("mouseover", function() {$familslider1904943259.unslider("stop");}).on("mouseout", function() {$familslider1904943259.unslider("start");});}); Every Saturday 9AM – 2PM Sponsors ( window.adva';

describe("sanitizeDescription", () => {
  it("extracts prose from Family Fun Vegas ad-slider JS", () => {
    assert.equal(sanitizeDescription(FFV_CORNERSTONE), "Every Saturday 9AM – 2PM");
  });

  it("is idempotent", () => {
    const once = sanitizeDescription(FFV_CORNERSTONE);
    assert.equal(sanitizeDescription(once), once);
  });

  it("strips HTML tags and decodes entities", () => {
    assert.equal(
      sanitizeDescription("<p>Storytime at 10am.&nbsp;Bring a blanket.</p>"),
      "Storytime at 10am. Bring a blanket.",
    );
  });

  it("strips markdown fences", () => {
    assert.equal(sanitizeDescription("```html\n<div>nope</div>\n``` Come play."), "Come play.");
  });

  it("returns empty when only code remains", () => {
    assert.equal(sanitizeDescription("function() { return 1; }"), "");
  });

  it("strips truncated Sponsors remnants after a 600-char slice", () => {
    assert.equal(
      sanitizeDescription(
        FFV_CORNERSTONE.replace(
          "Every Saturday 9AM – 2PM Sponsors ( window.adva",
          "Hours 2nd and 4th Sundays 9am-2pm Sponsors ( wi",
        ),
      ),
      "Hours 2nd and 4th Sundays 9am-2pm",
    );
    assert.equal(
      sanitizeDescription(
        FFV_CORNERSTONE.replace(
          "Every Saturday 9AM – 2PM Sponsors ( window.adva",
          "1st and 3rd Tuesdays of each month 2pm-7pm Sp",
        ),
      ),
      "1st and 3rd Tuesdays of each month 2pm-7pm",
    );
  });

  it("keeps parenthetical addresses that are not JS", () => {
    const raw =
      'Sponsors ( window.advanced_ads_ready || jQuery( document ).ready ).call( null, function() {var $familslider1 = jQuery( ".famil-slider-1" );$familslider1.unslider({ delay:8000 });}); Montagna Park (3495 Via Altamira) Every Thursday from 4pm';
    assert.equal(
      sanitizeDescription(raw),
      "Montagna Park (3495 Via Altamira) Every Thursday from 4pm",
    );
  });

  it("does not invent copy on a clean description", () => {
    const clean = "Join us Fridays at 3 pm in the Library Lobby for board games.";
    assert.equal(sanitizeDescription(clean), clean);
  });
});

describe("looksLikeCode", () => {
  it("flags the ad-slider dump", () => {
    assert.equal(looksLikeCode(FFV_CORNERSTONE), true);
  });

  it("does not flag ordinary parent copy", () => {
    assert.equal(looksLikeCode("Every Saturday 9AM – 2PM at Cornerstone Park."), false);
  });
});

describe("fallbackDescription", () => {
  it("uses title and venue", () => {
    assert.equal(
      fallbackDescription({ title: "Farmer’s Market", venue: "Cornerstone Park" }),
      "Farmer’s Market at Cornerstone Park.",
    );
  });
});

describe("stripMarkup", () => {
  it("turns <br> into a newline", () => {
    assert.equal(stripMarkup("A<br>B").trim(), "A\nB");
  });
});
