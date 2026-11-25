// tests/regulations.test.ts
// HIQA's words for a regulation, shown when its title is hovered over or tapped (lib/regulations.ts,
// CCARE-278): matched by number and title together, so another regulation's words are never shown.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { allRegulations, REGULATION_REFERENCES, regulationAnchor, regulationQuote } from "../lib/regulations.ts";

// The regulations page (CCARE-261) lists every regulation from the same entries the hover reads.
describe("the regulations page's list", () => {
  test("has each regulation from 1 to 34 once, in order", () => {
    assert.deepEqual(
      allRegulations().map((regulation) => regulation.number),
      Array.from({ length: 34 }, (_, index) => index + 1),
    );
  });

  test("gives each inspected regulation the words its title is hovered for", () => {
    for (const regulation of allRegulations()) {
      if (!("quote" in regulation)) continue;
      assert.deepEqual(regulationQuote(regulation), regulation.quote, `Regulation ${regulation.number}`);
    }
  });

  test("summarises only the two regulations that aren't inspected, and gives the hover nothing for them", () => {
    const summarised = allRegulations().filter((regulation) => "summary" in regulation);
    assert.deepEqual(summarised.map((regulation) => regulation.number), [1, 2]);
    for (const regulation of summarised) assert.equal(regulationQuote(regulation), null);
  });

  test("gives each regulation and each reference its own anchor", () => {
    const ids = [
      ...allRegulations().map((regulation) => regulationAnchor(regulation.number)),
      ...Object.values(REGULATION_REFERENCES).map((reference) => reference.id),
    ];
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("HIQA's words for a regulation", () => {
  test("are its National Standard, when the framework links one", () => {
    assert.deepEqual(regulationQuote({ number: 17, title: "Premises" }), {
      kind: "standard",
      standard: "2.6",
      text: "The residential service is homely and accessible and provides adequate physical space to meet each resident's assessed needs.",
    });
  });

  test("are a line of enquiry, when the framework links no standard", () => {
    assert.equal(regulationQuote({ number: 15, title: "Staffing" })?.kind, "enquiry");
  });

  test("don't mind case, spacing, a curly apostrophe or a closing full stop in the title", () => {
    assert.ok(regulationQuote({ number: 9, title: "Residents’  rights" }));
    assert.ok(regulationQuote({ number: 28, title: "FIRE PRECAUTIONS" }));
    assert.ok(
      regulationQuote({
        number: 33,
        title: "Notification of procedures and arrangements for periods when person in charge is absent from the designated centre.",
      }),
    );
  });

  test("know a regulation by another title a report uses for it", () => {
    assert.deepEqual(
      regulationQuote({ number: 27, title: "Protection against infection" }),
      regulationQuote({ number: 27, title: "Infection control" }),
    );
    assert.ok(regulationQuote({ number: 13, title: "End of life" }));
  });

  test("are none when the number has another regulation's title", () => {
    // Registration Regulation 4 is not Regulation 4, Written policies and procedures.
    assert.equal(regulationQuote({ number: 4, title: "Application for registration or renewal of registration" }), null);
  });

  test("are none for a number the framework doesn't cover", () => {
    assert.equal(regulationQuote({ number: 99, title: "Premises" }), null);
  });
});
