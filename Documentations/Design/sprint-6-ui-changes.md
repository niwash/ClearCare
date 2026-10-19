# Theme changes for older readers (CCARE-81)

Branch/Task: `CCARE-81-adult-centred-design`

These changes come from research done in **Sprint 5** (9–16 October 2026) and were carried out in **Sprint 6** (16–23 October 2026).

ClearCare will be used by older adults, some with cataracts, low contrast sensitivity or dementia, and by their families and care staff. These groups don't need the same thing, so ClearCare now has two designs, following SOARING guideline A1, "Design for diversity" [[1]](#ref-1). Users switch between them with the **Easier to read: Off / On** button in the header. Off is the default and keeps the navy design. On adds the changes marked *(Easier to read)* below. More background is in [adult-centred-design.md](../../Research/Design/adult-centred-design.md), and the full comparison of the two designs is in [easier-to-read-toggle.md](easier-to-read-toggle.md).

---

## What looks different

### A warm, high-contrast colour scheme *(Easier to read)*

- The page background is a warm off-white instead of grey. Cards and panels stay white.
- Text is near-black, and secondary text is a dark warm grey. We no longer use any light grey for text.
- Links and main buttons are a deep rust colour instead of navy blue.
  - For older eyes, hues can look tinted toward yellow, making "green, blue, and violet hard to distinguish" (Johnson & Finn, 2017, as cited in [[2]](#ref-2)); see also [[3]](#ref-3).
- Borders around cards and inputs are darker, so the edges of boxes and form fields are easy to see. In the default design, only form fields have dark (3:1) borders (WCAG 1.4.11) [[4]](#ref-4).

---

### What the colours mean

| Colour | Means | Used for |
|---|---|---|
| Rust (navy by default) | You can click this | Links and main buttons |
| Red | A problem | "Not compliant", error messages |
| Gold (amber by default) | Worth checking | "Substantially compliant" |
| Near-black | Nothing wrong | "Compliant" |
| Near-black, dashed outline | No information | "Not assessed" |

---

### Not relying on colour alone

- Every judgement marker has its own shape as well as its colour (filled circle, half circle, crossed square, dashed circle), plus a written label. *(Both designs)*
- Error messages ("Search unavailable", "This record isn't available right now") now have a title. *(Both designs)*
- They also show a warning icon and a thicker red border. *(Easier to read)*

### Links and keyboard focus

- All links are underlined. *(Both designs)*
- The underline is thicker, and also covers the main menu and the inspection dates in the history table. *(Easier to read)*
- Anything you can tab to shows a 2px outline in the text colour, and the search boxes show a focus ring (WCAG 2.4.7) [[4]](#ref-4). *(Both designs)*
- The outline is 3px on everything, including the search boxes (WCAG 2.4.13) [[4]](#ref-4). *(Easier to read)*

### Bigger buttons and links

- Links and buttons are at least 24 px tall, including smaller links (breadcrumbs, "Clear search", "Show all regulations", links inside the history table) (WCAG 2.5.8) [[4]](#ref-4). *(Both designs)*
- Main buttons, the theme toggle, "Add to list", "View record" and "HIQA register entry" are at least 44 × 44 px, and the smaller links above are at least 44 px tall (WCAG 2.5.5) [[4]](#ref-4). Links inside sentences, such as "Read its findings", are exempt. *(Easier to read)*

### Features that aren't ready yet *(Both designs)*

- Before, "Ask about this home" and "Add to list" were simply faded out, which was hard to read and didn't say why.
- They now have a dashed border, readable text and the words "(coming soon)".

---

## Secondary citations

Claims marked "as cited in" come from studies our sources cite. We haven't read the originals, so they aren't in the reference list (APA 7th edition). The original used here is:

- Johnson, J., & Finn, K. (2017). *Designing user interfaces for an aging population: Towards universal design*. Morgan Kaufmann. Cited in [[2]](#ref-2).

The full list of secondary citations across the design docs is in [adult-centred-design.md](../../Research/Design/adult-centred-design.md#secondary-citations).

---

## References

1. <a id="ref-1"></a>Turner, A. M., Sakaguchi-Tang, D., & Xu, S. (2020). *The essential guide to older adult-centered design: Supporting personal health information management* (rev. 12 June 2020). UW SOARING Study, University of Washington. <https://www.nwcphp.org/sites/www.nwcphp.org/files/documents/Revised_06-12-20_Guide-Older-Adult-Centered-Design-PHIM.pdf>
2. <a id="ref-2"></a>While, Z., Crouser, R. J., & Sarvghad, A. (2024). GerontoVis: Data visualization at the confluence of aging. *Computer Graphics Forum, 43*(3), Article e15101. <https://doi.org/10.1111/cgf.15101>. Preprint: <https://arxiv.org/abs/2403.13173>
3. <a id="ref-3"></a>Fredrickson, E. (2023, December). Universal design and aging in place. *Architectural Record* continuing education course, sponsored by Benjamin Moore. <https://continuingeducation.bnpmedia.com/courses/benjamin-moore/universal-design-and-aging-in-place/2/>. Note: about interior paint colours, not screens.
4. <a id="ref-4"></a>W3C. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2* [W3C Recommendation; first published 5 October 2023]. World Wide Web Consortium. <https://www.w3.org/TR/WCAG22/>
