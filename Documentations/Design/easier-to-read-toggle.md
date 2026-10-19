# "Easier to read" toggle

**Created:** 18 October 2026 · **Last modified:** 19 October 2026

ClearCare has two adult-centred designs, and users can switch between them with the **Easier to read: Off / On** button in the header.

- **Off (the default)** is for general users, most likely millennials looking for a home for a parent, and for older adults who are comfortable online. It meets **WCAG 2.2 Level AA**. W3C says existing standards such as WCAG address most of older users' needs [[3]](#ref-3) and recommends meeting at least Level A and AA for them [[2]](#ref-2).
- **On** is for older adults who struggle with the web. It adds the stricter **WCAG Level AAA** criteria and the guidance written specifically for older readers: the NIA/NLM checklist [[5]](#ref-5), NN/g [[4]](#ref-4), the Nutrition and Aging Resource Center [[6]](#ref-6) and GerontoVis [[7]](#ref-7).

Offering the choice follows SOARING guideline A1, "Design for diversity": "The older adult population is not homogeneous" [[1]](#ref-1).

How the toggle works:

- The choice is saved in the browser and applied before the page appears.
- It works in light and dark mode, and is separate from the light/dark switch.
- Screen readers announce it as a toggle button, "Easier to read", pressed or not pressed.

## What changes

| | Off: general users (WCAG AA) | On: older adults who struggle (AAA and older-adult guidance) |
| --- | --- | --- |
| **Text contrast** | At least 4.5:1 (WCAG 1.4.3, AA) [[10]](#ref-10). Cool navy and grey palette | At least 7:1 (WCAG 1.4.6, AAA) [[10]](#ref-10). Warm palette with near-black text and no light grey, because ageing reduces contrast sensitivity ([[3]](#ref-3); Johnson & Finn, 2017, as cited in [[7]](#ref-7)) and NN/g lists poor colour contrast among the barriers for older users [[4]](#ref-4) |
| **Link and button colour** | Navy | Saturated rust. Saturated colours are clearer for older eyes than pale ones [[8]](#ref-8), [[9]](#ref-9). A warm hue rather than blue because, for older eyes, hues can look tinted toward yellow, making "green, blue, and violet hard to distinguish" (Johnson & Finn, 2017, as cited in [[7]](#ref-7)) |
| **Form field borders** | At least 3:1 (WCAG 1.4.11, AA) [[10]](#ref-10). Card edges stay light because they are decorative | Darker borders on cards as well as fields |
| **Text size** | 16px body text, i.e. 12 point, the lower of the NIA/NLM sizes [[5]](#ref-5). Some smaller labels | 18px body text and header links, i.e. 13.5 point, just under the larger NIA/NLM size of 14 point (about 18.7px) ("Use 12 point or 14 point type size for body text" [[5]](#ref-5)). Small labels are at least about 16px. NN/g found text in apps "too small … for older adults to read comfortably" [[4]](#ref-4) |
| **Line spacing** | Browser and Tailwind defaults | At least 1.5 (WCAG 1.4.8, AAA) [[10]](#ref-10) |
| **Line length** | Not limited | At most 80 characters (WCAG 1.4.8, AAA) [[10]](#ref-10) |
| **Links** | Underlined: "Reserve underlining for links" [[5]](#ref-5); see also [[6]](#ref-6) | Thicker underline. Header links are underlined too |
| **Keyboard focus** | 2px outline on everything, with a focus ring on search fields (WCAG 2.4.7, AA) [[10]](#ref-10) | 3px outline on everything (WCAG 2.4.13, AAA) [[10]](#ref-10). W3C notes that "many people can't see small changes in visual appearance, including older people" [[11]](#ref-11) |
| **Tap targets** | At least 24px (WCAG 2.5.8, AA) [[10]](#ref-10) | At least 44px, including breadcrumbs and links in the history table (WCAG 2.5.5, AAA) [[10]](#ref-10). Links inside sentences are exempt. NIA/NLM: "large buttons that do not require precise mouse movements" [[5]](#ref-5). NN/g: targets "often displayed at a small size" [[4]](#ref-4) |
| **Colour alone** | Judgements have a shape and a label as well as a colour (WCAG 1.4.1, A) [[10]](#ref-10) | Error messages also get a warning icon and a thicker border. NIA/NLM: text and graphics should be understandable "on a black and white monitor" [[5]](#ref-5) |
| **National figures shading** | Up to 50% of the link colour | Up to 30%, so text on the darkest cell stays at least 7:1 (WCAG 1.4.6, AAA) [[10]](#ref-10) |
| **Hover on main buttons** | Fade slightly | Darker colour. |
| **Navigation on phones and tablets** | Behind a round menu button in the bottom-right corner. | Always visible as a row under the header. NIA/NLM: "Use pull down menus sparingly" and "Incorporate text with the icon if possible" [[5]](#ref-5) |

## The same in both

- **"(coming soon)" labels.** "Ask about this home", "Add to list" and unfinished menu items are shown in readable text with "(coming soon)", not faded out. WCAG doesn't require contrast for inactive controls [[10]](#ref-10), but faded text is hard for anyone to read, and the label explains why nothing happens.
- **Judgement shapes and labels, page content, layout and features.** Judgement colours follow each design's palette, so "Substantially compliant" is amber by default and gold in Easier to read.
- **Light and dark mode.** Dark-on-light stays the default [[5]](#ref-5), [[7]](#ref-7).

## Known gaps as of 19 October 2026

- **Line spacing.** NIA/NLM says to "double space all body text" [[5]](#ref-5). We used WCAG's 1.5 [[10]](#ref-10), because double spacing makes pages much longer on phones.
- **Paragraph spacing.** WCAG 1.4.8 also asks for paragraph spacing at least 1.5 times the line spacing [[10]](#ref-10). This isn't applied site-wide yet.
- **Serif headings.** NIA/NLM recommends a sans serif typeface [[5]](#ref-5). Body text is sans serif, but headings use a serif font in both designs.
- **Text size.** The Nutrition and Aging Resource Center says website text "should be at least 14-point" [[6]](#ref-6), about 18.7px. Body text is 16px (12 point) by default and 18px (13.5 point) in Easier to read.
- **Glossary and site map.** NIA/NLM recommends an online glossary of technical terms and a site map [[5]](#ref-5). Neither exists yet.
- **Chart date links.** The inspection dates in "Judgments at each inspection" on the centre page are under 44px in Easier to read (WCAG 2.5.5). That chart is being reworked, and the fix will go in with it.
- **Testing with older adults** is still to do: SOARING guideline E1 [[1]](#ref-1), and NIA/NLM's "A Final Check of the Web Site" [[5]](#ref-5).

## For developers

- On mode is switched on by `data-design="adult-centred"` on `<html>`, saved under the `design` key in `localStorage`.
- Colours, text sizes and focus styles for both designs are in `web/clearcare/app/globals.css`. Form fields use `border-field`, which is 3:1 in both designs.
- The toggle is `web/clearcare/components/theme/design-toggle.tsx`. The phone menu is `web/clearcare/components/layout/mobile-menu.tsx`.

## References
These are numbered the same as the references in [adult-centred-design.md](../../Research/Design/adult-centred-design.md#references), so [5] means the same source in both.

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
