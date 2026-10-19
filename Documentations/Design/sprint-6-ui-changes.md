# Theme changes for older readers (CCARE-81)

Branch/Task: `CCARE-81-adult-centred-design`

These changes come from research done in **Sprint 5** (9–16 October 2026) and were carried out in **Sprint 6** (16–23 October 2026).

ClearCare will be used by older adults, some with cataracts, low contrast sensitivity or dementia, and by their families and care staff. These groups don't need the same thing, so ClearCare now has two designs, switched with the **Easier to read: Off / On** button in the header. Off is the default.

This page lists what changed in Sprint 6. What each design does and why, with the sources, is in [easier-to-read-toggle.md](easier-to-read-toggle.md). The research behind it is in [adult-centred-design.md](../../Research/Design/adult-centred-design.md).

---

## "Easier to read" mode and phone menu (CCARE-115)

- Added the **Easier to read** toggle and the second design. Every difference between the two designs is in the [comparison table](easier-to-read-toggle.md#what-changes).
- In the standard design, phones and tablets get a round **Menu** button in the bottom-right corner. It works from the keyboard: Enter opens it, Tab goes through the links, and Escape closes it and returns focus to the button.
- In both designs, "Ask about this home" and "Add to list" are no longer faded out. They have a dashed border, readable text and the words "(coming soon)".
- In both designs, small links (breadcrumbs, "Clear search", links in the history table) are at least 24px tall.
- In Easier to read, headings are sans serif and small labels are no longer in capitals.
- Repeated class names are defined once, in `web/clearcare/components/ui/classes.ts`.

## Less text (CCARE-84)

- Shorter wording on the start, search, centre and contacts pages, and in the inspection history.

## Components and resources (CCARE-101)

- **Centre page:** the home's details are in one box, like on hiqa.ie.
- **Contacts:** each section is an accordion. A new Fair Deal section lists HSE Live, Citizens Information and all 17 local Nursing Homes Support Offices.
- **Resources:** whole-card links, guides in the order families need them, "Draft" and "coming soon" labels, and links to official guides (HSE, Citizens Information, CCPC, HIQA).
- **Menu:** "About the data" is removed until that page exists.
