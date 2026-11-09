# The privacy notice changes in the same pull request as the code it describes

The privacy notice at `/privacy` (`web/clearcare/app/(site)/privacy/page.tsx`) is the complete account of the personal data ClearCare handles. A pull request that changes what that account would say updates the notice in the same pull request, together with its `LAST_UPDATED` date, wherever the change is made: the site, the API, the database migrations, the pipeline, or the extraction and research scripts.

A change needs this when it:

- stores something new in a visitor's browser (`localStorage`, `sessionStorage` or a cookie), or changes what an existing key holds or how long it lasts;
- stores something new about a visitor or an account in the database, or keeps it longer;
- embeds something that sets its own cookies, as the Microsoft Forms survey does;
- stores something new about a person named in the reports (the person in charge, the provider, an inspector or staff), whom the pipeline and research code handle under GDPR Article 14;
- uses the reports for a new purpose, such as a new model task or research analysis, or shows on the site something that was only used for research;
- keeps raw files, parsed text, extractions or research outputs longer, or keeps a new copy of them;
- combines the reports with another source in a way that could make a resident easier to identify;
- sends personal data to a service the notice does not cover, or moves it to a new region: a new host, a new AI provider, or a new default provider, as CCARE-198's move from OpenAI to Anthropic was.

A change that leaves all of these as they were does not touch the notice. Rewording, layout, refactoring, fixes to code that already stores and sends the same things, and reloading reports through the same steps do not count.

The notice is a statement of fact, not documentation. GDPR Articles 13 and 14 require it to say what is collected, from where, why, on what legal basis, for how long and who receives it, so a notice missing a key the site writes, or a provider the pipeline sends reports to, is wrong from the day that change ships. Until now it has been kept right by whoever remembered: the shortlist, the theme, the easier-to-read design, the welcome tour, the last search, the saved search (ADR-0025), the sign-in cookies (ADR-0020) and the AI providers were each added in their own branches. ADR-0020 left the notice to a separate record, and this is it. In the same pull request, the reviewer sees the change and the sentence describing it together.

The code comments in the notice that say where each statement comes from (an ADR, a file or a PR) are updated with it, so the next person can check the sentence against the code. The comment on "Who handles it" records when it was last checked against the code, and that date moves when it is checked again.

The cost is a sentence of plain English alongside the code, and a notice that grows with the project. The rule depends on the author and the reviewer noticing that a change touches personal data, which is easiest to miss in the pipeline, where a new column looks like an ordinary schema change.

Two alternatives were not taken. Updating the notice periodically, after a batch of changes, leaves code running that the notice does not describe, which is the failure this record prevents. Building the browser part of the notice from one list of storage keys, with a test that fails on a key the list lacks, would enforce part of the rule, but it means moving every component's key into one module and covers none of the pipeline; it is left for later, if asking proves not to be enough.

This record does not decide on a cookie banner or consent mechanism: nothing the site sets today needs consent, and anything that does needs a decision of its own.
