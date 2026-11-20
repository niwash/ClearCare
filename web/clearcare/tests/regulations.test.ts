// tests/regulations.test.ts
// HIQA's words for a regulation, shown when its title is hovered over or tapped (lib/regulations.ts,
// CCARE-278): matched by number and title together, so another regulation's words are never shown.
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { regulationQuote } from "../lib/regulations.ts";

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
