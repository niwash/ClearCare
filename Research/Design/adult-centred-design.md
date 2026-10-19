# Adult-Centred Design

**Created:** 15 October 2026 · **Last modified:** 19 October 2026

This document covers the research background for ClearCare's design. It discusses who we design for, how ageing affects web use, what the guides and standards recommend, and how these are applied to ClearCare. What we actually changed is in [sprint-6-ui-changes.md](../../Documentations/Design/sprint-6-ui-changes.md), and how the two designs differ is in [easier-to-read-toggle.md](../../Documentations/Design/easier-to-read-toggle.md).

---

## Who we are designing for

- **Families**, most likely adult children (often millennials) looking for a home for a parent. They are usually comfortable online.
- **Older adults** choosing a home for themselves or a partner. Some are confident web users. Others live with cataracts, low contrast sensitivity, tremor or memory problems.
- **Care staff and advocates** helping someone else decide.

To accommodate all groups, ClearCare has two designs, chosen with the "Easier to read" toggle (see [How this is applied to the site](#how-this-is-applied-to-the-site)). These groups don't need the same thing. SOARING guideline A1, "Design for diversity", says: "The older adult population is not homogeneous… Consider approaches like inclusive design to reach people… with differing abilities" [[1]](#ref-1).

---

## Why WCAG is the baseline

- There is no separate web standard for older adults. W3C's WAI-AGE project found that existing W3C standards, including WCAG, address most of older users' needs [[3]](#ref-3).
- W3C recommends meeting "at least all WCAG 2.0 Level A and AA success criteria" for older users [[2]](#ref-2).
- The SOARING guide tells designers to use accepted web accessibility guidelines, pointing to W3C's Web Accessibility Initiative (guideline A4) [[1]](#ref-1).
- We follow WCAG 2.2, the newest version. It keeps the success criteria from 2.0 and 2.1, except the obsolete 4.1.1 Parsing [[10]](#ref-10), [[11]](#ref-11).

WCAG has three levels: A (minimum), AA (the usual target) and AAA (enhanced). AAA can't be met for all content, but several AAA criteria are a good fit for older readers. ClearCare uses AA for everyone and adds the AAA criteria in the "Easier to read" design.

---

## How ageing affects web use

The NIA/NLM checklist stresses that "advanced age is not a hindrance to computer or Internet use", but that age-associated declines "may limit the use of electronic technology" [[5]](#ref-5).

### Vision

- Ageing reduces "the amount of light that reaches the retina", contrast sensitivity, and "the ability to detect fine details" (Echt, 2002, as cited in [[5]](#ref-5)). W3C lists reduced contrast sensitivity among older users' needs [[3]](#ref-3).
- NN/g notes that "people in their 40s already have sufficiently reduced eyesight to require somewhat larger font sizes", and that text in apps was "often too small and lightly colored for older adults to read comfortably" [[4]](#ref-4).
- Long-term exposure to ultraviolet light can yellow the lens of the eye (Mitzner et al., 2015, as cited in [[7]](#ref-7)), and hues can look tinted toward yellow, making "green, blue, and violet hard to distinguish" (Johnson & Finn, 2017, as cited in [[7]](#ref-7)); see also [[9]](#ref-9). Contrast sensitivity "often continues to decline, usually becoming acute by age 80" (Johnson & Finn, 2017, as cited in [[7]](#ref-7)). In a study of 60 adults aged 65 to 90 rating colour samples under indoor lighting, colour discrimination was affected "mainly in the lower saturation and not in the higher saturation" [[8]](#ref-8).

### Movement

- Small targets are hard to hit. NN/g found "buttons, dropdowns, and links are often displayed at a small size" [[4]](#ref-4). W3C's example user for target size is "a retiree with hand tremor" [[11]](#ref-11).

### Thinking and memory

- The ability "to simultaneously remember and process new information, to perform complex cognitive tasks, and to comprehend text" decreases with age (Craik & Salthouse, 2000, as cited in [[5]](#ref-5)), and "older adults also process information more slowly than younger adults" [[5]](#ref-5).

---

## What the guides recommend

### Text

- "Use a sans serif typeface… that is not condensed" [[5]](#ref-5).
- "Use 12 point or 14 point type size for body text" [[5]](#ref-5), i.e. 16px or about 18.7px on screen.
- "Use medium or bold face type" [[5]](#ref-5).
- "Present body text in upper and lowercase letters. Use all capital letters and italics in headlines only" [[5]](#ref-5).
- "Double space all body text" [[5]](#ref-5).
- "Left justified text is optimal for older adults" [[5]](#ref-5).

### Colour and contrast

- "Use dark type or graphics against a light background, or white lettering on a black or dark-colored background. Avoid patterned backgrounds" [[5]](#ref-5).
- Reviewing four vision studies, GerontoVis concludes that dark-on-light ("negative contrast") is "generally a more favorable choice for older adults" [[7]](#ref-7). GerontoVis also reports that Whitlock and McLaughlin recommended changing "dark-grey-on-light-grey text and lines to black-on-white" (Whitlock & McLaughlin, 2012, as cited in [[7]](#ref-7)).
- "Avoid yellow and blue and green in close proximity" [[5]](#ref-5).
- "Ensure that text and graphics are understandable when viewed on a black and white monitor" [[5]](#ref-5): colour should never be the only signal.
- Prefer saturated colours to pale ones. In [[8]](#ref-8), "the elderly rated the high saturation colors as most acceptable with regard to contrast/clarity", whatever the hue. Blue was rated lowest at low saturation but highest at high saturation, so the study supports saturation, not one hue over another. Ageing-in-place guidance also treats pastels for older people as a misconception [[9]](#ref-9).

### Links and navigation

- "Reserve underlining for links" [[5]](#ref-5). The Nutrition and Aging Resource Center also advises a different colour and underlining for links [[6]](#ref-6).
- "The organization of the web site should be simple and straightforward… Carefully label links" [[5]](#ref-5).
- "Use the same set of navigation buttons in the same place on each page" [[5]](#ref-5).
- "Use pull down menus sparingly" [[5]](#ref-5).
- "Use single mouse clicks to access information" [[5]](#ref-5).
- "Provide a site map to show how the site is organized" [[5]](#ref-5).

### Buttons and icons

- "Incorporate text with the icon if possible, and use large buttons that do not require precise mouse movements for activation" [[5]](#ref-5).

### Writing

- "Present information in a clear and familiar way… Use positive statements" [[5]](#ref-5).
- "Use the active voice" [[5]](#ref-5).
- "Write the text in simple language. Provide an online glossary of technical terms" [[5]](#ref-5).
- "Break lengthy documents into short sections" [[5]](#ref-5).

### Help and testing

- "Offer a telephone number for those who would prefer to talk to a person" [[5]](#ref-5).
- Involve older adults throughout design, including usability testing: SOARING guideline E1 [[1]](#ref-1), and NIA/NLM's final check, "Solicit unbiased comments from older adults through focus groups, usability testing or other means" [[5]](#ref-5).

---

## WCAG success criteria we use

| Criterion | Level | What it asks | ClearCare |
| --- | --- | --- | --- |
| 1.4.1 Use of Color | A | Colour isn't "the only visual means of conveying information" | Both designs |
| 1.4.3 Contrast (Minimum) | AA | Text at least 4.5:1, large text 3:1 | Both designs |
| 1.4.4 Resize Text | AA | Text can be resized to 200% without losing content or function | Both designs |
| 1.4.10 Reflow | AA | Content works at 320px wide without scrolling in two directions | Both designs |
| 1.4.11 Non-text Contrast | AA | Controls and meaningful graphics at least 3:1 | Both designs |
| 2.4.7 Focus Visible | AA | A visible keyboard focus indicator | Both designs |
| 2.5.8 Target Size (Minimum) | AA | Targets at least 24 × 24px, with some exceptions | Both designs |
| 1.4.6 Contrast (Enhanced) | AAA | Text at least 7:1, large text 4.5:1 | Easier to read |
| 1.4.8 Visual Presentation | AAA | See below | Easier to read, in part |
| 2.4.13 Focus Appearance | AAA | Focus indicator at least as large as a 2px outline, 3:1 change in contrast | Easier to read |
| 2.5.5 Target Size (Enhanced) | AAA | Targets at least 44 × 44px | Easier to read |

### Notes on 1.4.4 Resize Text

- Except for captions and images of text, text can be resized without assistive technology up to 200% without loss of content or functionality.

### Notes on 1.4.8 Visual Presentation

For blocks of text, WCAG 1.4.8 asks that [[10]](#ref-10):

- "Foreground and background colors can be selected by the user."
- "Width is no more than 80 characters or glyphs (40 if CJK)."
- "Text is not justified (aligned to both the left and the right margins)."
- "Line spacing (leading) is at least space-and-a-half within paragraphs, and paragraph spacing is at least 1.5 times larger than the line spacing."
- "Text can be resized without assistive technology up to 200 percent in a way that does not require the user to scroll horizontally to read a line of text on a full-screen window."

The WCAG 2.2 Understanding document for 1.4.8 lists sufficient techniques but no advisory techniques. The advisory techniques below are from the WCAG 2.0 Understanding document, which W3C no longer maintains (<https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-visual-presentation.html>). We keep them as extra guidance, not as WCAG 2.2 requirements:

- Using a hover effect to highlight a paragraph, list items or table cells
- Presenting text in sans serif font, or providing a mechanism to achieve this
- Using vertical (bulleted or numbered) lists rather than inline lists
- Using upper and lower case according to the spelling conventions of the text language
- Providing large fonts by default
- Avoiding the use of text in raster images
- Avoiding scaling font sizes smaller than the user-agent default
- Providing sufficient inter-column spacing
- Avoiding centrally aligned text
- Avoiding chunks of italic text
- Avoiding overuse of different styles on individual pages and in sites
- Making links visually distinct
- Providing expandable bullets
- Show/hide bullet points
- Putting an em-space or two spaces after sentences

---

## How this is applied to the site

ClearCare has two designs. Users can choose between them with the **Easier to read: Off / On** button in the header.

- **Off (the default)** is for families and confident older adults. It meets WCAG 2.2 Level AA, which W3C says covers most older users' needs [[2]](#ref-2), [[3]](#ref-3). It uses a cool navy palette, underlined links, a visible focus outline, 3:1 form-field borders and 24px targets.
- **On** is for older adults who struggle. It adds the AAA criteria above and the older-adult guidance: a warm high-contrast palette, sans serif headings, no small capitals in labels, 18px text with 1.5 line spacing, lines of 80 characters or fewer, thicker underlines, a 3px focus outline, 44px targets, warning icons on errors, and navigation that is always visible.

The full side-by-side comparison is in [easier-to-read-toggle.md](../../Documentations/Design/easier-to-read-toggle.md).

### Not yet applied

- Double-spaced body text [[5]](#ref-5). We use WCAG's 1.5 line spacing instead [[10]](#ref-10).
- Paragraph spacing of 1.5 times the line spacing (WCAG 1.4.8) [[10]](#ref-10).
- A glossary of technical terms, and a site map [[5]](#ref-5).
- 14-point text. The Nutrition and Aging Resource Center says website text "should be at least 14-point" [[6]](#ref-6), about 18.7px. Body text is 16px (12 point) by default and 18px (13.5 point) in Easier to read.
- Testing with older adults [[1]](#ref-1), [[5]](#ref-5).

---

## Secondary citations

| Claim | Original | Cited in |
| --- | --- | --- |
| Less light reaches the retina; loss of contrast sensitivity and fine detail | Echt, K. V. (2002). Designing web-based health information for older adults: Visual considerations and design directives. In R. W. Morrell (Ed.), *Older adults, health information, and the World Wide Web* (pp. 61–88). Lawrence Erlbaum Associates. (Cited as "in press" in [[5]](#ref-5).) | [[5]](#ref-5) |
| Decline in remembering and processing information, complex tasks and text comprehension | Craik, F. I. M., & Salthouse, T. A. (Eds.). (2000). *The handbook of aging and cognition* (2nd ed.). Lawrence Erlbaum Associates. | [[5]](#ref-5) |
| Lens yellowing from long-term ultraviolet exposure | Mitzner, T. L., Smarr, C.-A., Rogers, W. A., & Fisk, A. D. (2015). Considering older adults' perceptual capabilities in the design process. In R. R. Hoffman, P. A. Hancock, M. W. Scerbo, R. Parasuraman, & J. L. Szalma (Eds.), *The Cambridge handbook of applied perception research* (Vol. 2, pp. 1051–1079). Cambridge University Press. | [[7]](#ref-7) |
| Hues tinted toward yellow, so green, blue and violet are hard to distinguish; contrast sensitivity decline | Johnson, J., & Finn, K. (2017). *Designing user interfaces for an aging population: Towards universal design*. Morgan Kaufmann. | [[7]](#ref-7) |
| "Dark-grey-on-light-grey text and lines to black-on-white" (GerontoVis's summary of the recommendation) | Whitlock, L. A., & McLaughlin, A. C. (2012). Identifying usability problems of blood glucose tracking apps for older adult users. *Proceedings of the Human Factors and Ergonomics Society Annual Meeting, 56*(1), 115–119. <https://doi.org/10.1177/1071181312561001> | [[7]](#ref-7) |

GerontoVis's conclusion on dark-on-light text is its own synthesis, so it is cited directly. The studies it reviews are Chung & Mansfield (2009), Piepenbrock et al. (2013), Spehar (2002) and Rubin & Legge (1989).

In the NIA/NLM checklist, the statement that older adults process information more slowly has no citation directly after it. The paragraph ends with footnote 2 (Czaja & Sharit, 1998; Morrell, 1997), which may cover it, but we haven't checked those sources, so the statement is cited to the checklist directly.

---

## References

1. <a id="ref-1"></a>Turner, A. M., Sakaguchi-Tang, D., & Xu, S. (2020). *The essential guide to older adult-centered design: Supporting personal health information management* (rev. 12 June 2020). UW SOARING Study, University of Washington. <https://www.nwcphp.org/sites/www.nwcphp.org/files/documents/Revised_06-12-20_Guide-Older-Adult-Centered-Design-PHIM.pdf>
2. <a id="ref-2"></a>W3C Web Accessibility Initiative. (2010). *Developing websites for older people: How Web Content Accessibility Guidelines (WCAG) 2.0 applies* (reviewed 1 January 2018). World Wide Web Consortium. <https://www.w3.org/WAI/older-users/developing/>
3. <a id="ref-3"></a>W3C Web Accessibility Initiative. (2025, November 20). *Older users and web accessibility: Meeting the needs of ageing web users*. World Wide Web Consortium. <https://www.w3.org/WAI/older-users/>
4. <a id="ref-4"></a>Kane, L. (2019, September 8). *Usability for older adults: Challenges and changes*. Nielsen Norman Group. <https://www.nngroup.com/articles/usability-for-senior-citizens/>
5. <a id="ref-5"></a>National Institute on Aging & National Library of Medicine. (2001, February). *Making your web site senior friendly: A checklist*. National Institutes of Health. Copy consulted: <https://www.huzurevleri.org.tr/docs/MakingYourWebsiteSeniorFriendly.pdf>
6. <a id="ref-6"></a>Nutrition and Aging Resource Center. (n.d.). *Basic tips on web design for an older adult audience*. Administration for Community Living. <https://acl.gov/sites/default/files/nutrition/BasicTipsOnWebDesignForAnOlderAdultAudience.pdf>. The original link returned 403 on 18 October 2026. Archived copy: <https://web.archive.org/web/20260101010359/https://acl.gov/sites/default/files/nutrition/BasicTipsOnWebDesignForAnOlderAdultAudience.pdf>
7. <a id="ref-7"></a>While, Z., Crouser, R. J., & Sarvghad, A. (2024). GerontoVis: Data visualization at the confluence of aging. *Computer Graphics Forum, 43*(3), Article e15101. <https://doi.org/10.1111/cgf.15101>. Preprint: <https://arxiv.org/abs/2403.13173>
8. <a id="ref-8"></a>Hegde, A. L. (2007). *Effects of hue and artificial light sources on visual contrast by the aging eye* (Research Enhancement Program project summary). Texas State University. <https://digital.library.txst.edu/items/f501443a-a187-4cf8-ac6f-5a24356b3394/full>. File: <https://digital.library.txst.edu/server/api/core/bitstreams/8bed7e81-9aea-4784-b577-66504e9e127b/content>. Note: a one-page project summary, not peer-reviewed. It is the first page of a three-page file; the other pages belong to a different investigator's report. It tested colour samples under indoor lighting, not screens. The name is spelled "Hedge" in the document.
9. <a id="ref-9"></a>Fredrickson, E. (2023, December). Universal design and aging in place. *Architectural Record* continuing education course, sponsored by Benjamin Moore. <https://continuingeducation.bnpmedia.com/courses/benjamin-moore/universal-design-and-aging-in-place/2/>. Note: about interior paint colours, not screens.
10. <a id="ref-10"></a>W3C. (2024, December 12). *Web Content Accessibility Guidelines (WCAG) 2.2* [W3C Recommendation; first published 5 October 2023]. World Wide Web Consortium. <https://www.w3.org/TR/WCAG22/>
11. <a id="ref-11"></a>W3C Web Accessibility Initiative. (2023, October 5). *What's new in WCAG 2.2*. World Wide Web Consortium. <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
