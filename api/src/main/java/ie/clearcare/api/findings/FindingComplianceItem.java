package ie.clearcare.api.findings;

import java.time.LocalDate;

/** One item of the compliance plan under a finding's regulation, such as Regulation 28(1)(a). */
record FindingComplianceItem(String regulation, String riskRating, LocalDate dateToComply) {}
