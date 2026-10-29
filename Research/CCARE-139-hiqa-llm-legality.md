Legality of Using HIQA Reports in LLMs

Purpose: Investigating whether ClearCare can legally use publicly available HIQA nursing-home inspection reports in a Large Language Model (LLM) pipeline to extract and present factual information about nursing-home amenities and facilities.

## 1. HIQA's Reuse Policy

HIQA’s official disclaimer states that information on its website is copyrighted by HIQA, but may be reused free of charge in any format, subject to the latest Public Sector Information (PSI) licence. This supports the reuse of HIQA material provided that the applicable licence conditions are followed. Public availability alone should not be treated as unrestricted permission for every use.

Source: https://www.hiqa.ie/disclaimer

## 2. Copyright and Text/Data Mining

Irish copyright law provides exceptions relevant to computational analysis and text and data mining (TDM):

- Non-commercial research: Section 53A of the Copyright and Related Rights Act 2000, inserted by section 14 of the Copyright and Other Intellectual Property Law Provisions Act 2019, provides an exception for certain copies made by a person with lawful access, for computational analysis solely for non-commercial research, with sufficient acknowledgement. Restrictions apply to transferring copies and using them for other purposes.

- Text and data mining: Section 53B provides a TDM exception for certain uses where the rightsholder has not expressly reserved the relevant rights in an appropriate manner. Lawful access and applicable statutory conditions remain important.

The applicability of these exceptions to ClearCare depends on the exact use, the licence conditions, whether rights have been reserved, and whether the activity is research, product operation or commercial use. This requires further confirmation before deployment.

Sources:

- Copyright and Other Intellectual Property Law Provisions Act 2019, section 14: https://www.irishstatutebook.ie/eli/2019/act/19/section/14/enacted/en/html

- Copyright and Related Rights Act 2000, section 53A: https://revisedacts.lawreform.ie/eli/2000/act/28/section/53A/revised/en/html

- Copyright and Related Rights Act 2000, section 53B: https://revisedacts.lawreform.ie/eli/2000/act/28/section/53B/revised/en/html

## 3. Application to ClearCare

The proposed use is to process HIQA reports and extract structured information about nursing-home amenities, including:

- Types of care provided

- Bedroom and bathroom arrangements

- Outdoor spaces and gardens

- Activities and recreational facilities

- Transport facilities

- Chapels and religious services

- Named residential or specialist units

- Dining arrangements

- Other amenities

The system should preserve the meaning of the source reports and avoid inventing information that is not explicitly stated.

## 4. Recommended Safeguards

- Attribute each report to HIQA and retain its source URL and inspection date.

- Preserve source wording where appropriate and distinguish extracted facts from generated summaries.

- Represent unmentioned or uncertain information as unknown, rather than assuming the facility is absent.

- Avoid reproducing extensive report text when a concise factual extraction is sufficient.

- Review how downloaded PDFs, extracted text, prompts, model outputs and logs are stored and retained.

- Check the terms of any external LLM provider before uploading reports, particularly its data retention, model-training and confidentiality policies.

- Recheck the applicable HIQA PSI licence and copyright conditions before commercial deployment.

## 5. Key Risks and Open Questions

- Does the current HIQA PSI licence permit the intended automated extraction and commercial use?

- Does the licence impose attribution, accuracy or other conditions that must be implemented in ClearCare?

- Does the chosen LLM provider retain submitted reports or use them for model training?

- Does the proposed workflow involve temporary processing, persistent storage, or training/fine-tuning a model? These are different activities and should be assessed separately.

- Could reports contain personal or sensitive information that requires additional data-protection safeguards?

- Are there any restrictions relating to database rights, third-party material or other rights within the reports?

## 6. Conclusion

HIQA’s published disclaimer expressly permits reuse of its website information subject to the applicable PSI licence. Irish copyright legislation also contains relevant text and data mining exceptions, but their application depends on the specific circumstances. The research therefore supports further development of a source-attributed, factual extraction workflow, subject to verification of the current licence and the project’s exact technical and commercial use. It does not establish blanket permission for all LLM training, storage or third-party processing.

Before production deployment, obtain confirmation from HIQA or appropriate legal advice on any unresolved licensing questions. This document is preliminary research, not formal legal advice or final legal clearance.

## References

1. HIQA — Disclaimer and reuse policy
https://www.hiqa.ie/disclaimer

1. Copyright and Other Intellectual Property Law Provisions Act 2019, section 14
https://www.irishstatutebook.ie/eli/2019/act/19/section/14/enacted/en/html

1. Copyright and Related Rights Act 2000, section 53A
https://revisedacts.lawreform.ie/eli/2000/act/28/section/53A/revised/en/html

1. Copyright and Related Rights Act 2000, section 53B
https://revisedacts.lawreform.ie/eli/2000/act/28/section/53B/revised/en/html
