package ie.clearcare.api.findings;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads a centre's findings from the views the clearcare_api role can read: the re-assessment
 * (db/V14), the reports (db/V3), their text (db/V5) and its commitments (db/V6).
 */
@Repository
class CentreFindingsRepository {

  // V5 and V6 define no order between versions, so the served ones change with the next extraction.
  private static final String EXTRACTOR_VERSION = "text-v1";
  private static final String SPLITTER_VERSION = "rules-v3";

  // The register's views (db/V1). Findings are served only for a centre the register snapshot
  // has, and only once a snapshot has been published, as reports are.
  private static final String REGISTER_SNAPSHOT =
      "SELECT 1 FROM clearcare.published_register_snapshot";

  private static final String CENTRE =
      "SELECT 1 FROM clearcare.centre_search WHERE centre_id = :centre_id";

  // Newest inspection first, then by report_id so that each report's findings stay together,
  // then by regulation number, so that Regulation 9 comes before Regulation 28.
  private static final String FINDINGS =
      """
      SELECT
          finding.report_id,
          finding.inspection_date,
          report.report_url,
          finding.regulation,
          finding.title,
          finding.judgment,
          inspector.text AS inspector_text,
          inspector.first_page AS inspector_first_page,
          inspector.last_page AS inspector_last_page,
          response.id AS response_id,
          response.text AS response_text,
          response.first_page AS response_first_page,
          response.last_page AS response_last_page,
          EXISTS (
              SELECT FROM clearcare.report_commitment
              WHERE response_id = response.id AND splitter_version = :splitter_version
          ) AS response_split,
          finding.re_assessment_status,
          finding.re_assessment_report_id,
          finding.re_assessment_inspection_date,
          re_assessment_report.report_url AS re_assessment_report_url,
          finding.re_assessment_judgment,
          finding.reports_between,
          re_assessment_inspector.text AS re_assessment_inspector_text,
          re_assessment_inspector.first_page AS re_assessment_inspector_first_page,
          re_assessment_inspector.last_page AS re_assessment_inspector_last_page
      FROM clearcare.finding_re_assessment AS finding
      INNER JOIN clearcare.centre_report AS report
          ON finding.report_id = report.report_id
      LEFT JOIN clearcare.centre_report AS re_assessment_report
          ON finding.re_assessment_report_id = re_assessment_report.report_id
      LEFT JOIN clearcare.report_text AS inspector
          ON finding.report_id = inspector.report_id
          AND inspector.kind = 'narrative'
          AND finding.regulation = inspector.regulation
          AND inspector.extractor_version = :extractor_version
      LEFT JOIN clearcare.report_text AS response
          ON finding.report_id = response.report_id
          AND response.kind = 'response'
          AND finding.regulation = response.regulation
          AND response.extractor_version = :extractor_version
      LEFT JOIN clearcare.report_text AS re_assessment_inspector
          ON finding.re_assessment_report_id = re_assessment_inspector.report_id
          AND re_assessment_inspector.kind = 'narrative'
          AND finding.regulation = re_assessment_inspector.regulation
          AND re_assessment_inspector.extractor_version = :extractor_version
      WHERE finding.centre_id = :centre_id
      ORDER BY
          finding.inspection_date DESC NULLS LAST,
          finding.report_id,
          substring(finding.regulation FROM '[0-9]+')::integer,
          finding.regulation
      """;

  // An item belongs to the regulation whose number it starts with: Regulation 28(1)(a) to
  // Regulation 28. The digits are read whole, so Regulation 2 does not take it.
  private static final String COMPLIANCE_ITEMS =
      """
      SELECT
          item.report_id,
          substring(item.regulation FROM '^Regulation [0-9]+') AS finding_regulation,
          item.regulation,
          item.risk_rating,
          item.date_to_comply
      FROM clearcare.report_compliance_item AS item
      INNER JOIN clearcare.centre_report AS report ON item.report_id = report.report_id
      WHERE report.centre_id = :centre_id
      ORDER BY item.id
      """;

  // Only commitments with a deadline: the response is served whole, and a span can combine
  // actions (ADR-0017), so the others are not shown as separate commitments.
  private static final String STATED_DEADLINES =
      """
      SELECT
          commitment.response_id,
          commitment.text,
          commitment.stated_deadline,
          commitment.stated_deadline_text,
          commitment.deadline_precision,
          commitment.page,
          commitment.last_page
      FROM clearcare.report_commitment AS commitment
      INNER JOIN clearcare.centre_report AS report ON commitment.report_id = report.report_id
      WHERE
          report.centre_id = :centre_id
          AND commitment.extractor_version = :extractor_version
          AND commitment.splitter_version = :splitter_version
          AND commitment.stated_deadline IS NOT NULL
      ORDER BY commitment.response_id, commitment.start_offset
      """;

  private final JdbcClient jdbc;

  CentreFindingsRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Returns the findings of the reports ClearCare has loaded for this centre, or nothing if no
   * register snapshot has been published. findings is null if the snapshot does not have the
   * centre. Everything is read in one transaction, so the findings, their text and their
   * re-assessments agree even if a report is loaded meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreFindingsResult> findFindings(String centreId) {
    if (!registerPublished()) {
      return Optional.empty();
    }
    if (!centreExists(centreId)) {
      return Optional.of(new CentreFindingsResult(centreId, null));
    }
    return Optional.of(new CentreFindingsResult(centreId, findings(centreId)));
  }

  private boolean registerPublished() {
    return jdbc.sql(REGISTER_SNAPSHOT).query(Integer.class).optional().isPresent();
  }

  private boolean centreExists(String centreId) {
    return jdbc.sql(CENTRE).param("centre_id", centreId).query(Integer.class).optional().isPresent();
  }

  private List<Finding> findings(String centreId) {
    Map<FindingKey, List<FindingComplianceItem>> complianceItems = complianceItems(centreId);
    Map<Long, List<StatedDeadline>> statedDeadlines = statedDeadlines(centreId);
    return jdbc.sql(FINDINGS)
        .param("centre_id", centreId)
        .param("extractor_version", EXTRACTOR_VERSION)
        .param("splitter_version", SPLITTER_VERSION)
        .query((rs, rowNumber) -> finding(rs, complianceItems, statedDeadlines))
        .list();
  }

  private Map<FindingKey, List<FindingComplianceItem>> complianceItems(String centreId) {
    return jdbc.sql(COMPLIANCE_ITEMS)
        .param("centre_id", centreId)
        .query(
            (rs, rowNumber) ->
                Map.entry(
                    new FindingKey(rs.getLong("report_id"), rs.getString("finding_regulation")),
                    new FindingComplianceItem(
                        rs.getString("regulation"),
                        rs.getString("risk_rating"),
                        rs.getObject("date_to_comply", LocalDate.class))))
        .list()
        .stream()
        .collect(groupingBy(Map.Entry::getKey, mapping(Map.Entry::getValue, toList())));
  }

  // Keyed by the response row's id, so a finding gets the commitments of the response it serves.
  private Map<Long, List<StatedDeadline>> statedDeadlines(String centreId) {
    return jdbc.sql(STATED_DEADLINES)
        .param("centre_id", centreId)
        .param("extractor_version", EXTRACTOR_VERSION)
        .param("splitter_version", SPLITTER_VERSION)
        .query(
            (rs, rowNumber) ->
                Map.entry(
                    rs.getLong("response_id"),
                    new StatedDeadline(
                        rs.getString("text"),
                        rs.getObject("stated_deadline", LocalDate.class),
                        rs.getString("stated_deadline_text"),
                        rs.getString("deadline_precision"),
                        rs.getInt("page"),
                        rs.getInt("last_page"))))
        .list()
        .stream()
        .collect(groupingBy(Map.Entry::getKey, mapping(Map.Entry::getValue, toList())));
  }

  private static Finding finding(
      ResultSet rs,
      Map<FindingKey, List<FindingComplianceItem>> complianceItems,
      Map<Long, List<StatedDeadline>> statedDeadlines)
      throws SQLException {
    long reportId = rs.getLong("report_id");
    String regulation = rs.getString("regulation");
    Long responseId = rs.getObject("response_id", Long.class);
    return new Finding(
        reportId,
        rs.getObject("inspection_date", LocalDate.class),
        rs.getString("report_url"),
        regulation,
        rs.getString("title"),
        rs.getString("judgment"),
        complianceItems.getOrDefault(new FindingKey(reportId, regulation), List.of()),
        text(rs, "inspector"),
        text(rs, "response"),
        rs.getBoolean("response_split")
            ? statedDeadlines.getOrDefault(responseId, List.of())
            : null,
        new ReAssessment(
            rs.getString("re_assessment_status"),
            rs.getObject("re_assessment_report_id", Long.class),
            rs.getObject("re_assessment_inspection_date", LocalDate.class),
            rs.getString("re_assessment_report_url"),
            rs.getString("re_assessment_judgment"),
            rs.getObject("reports_between", Long.class),
            text(rs, "re_assessment_inspector")));
  }

  // The columns of one LEFT JOINed report_text row, or null when there is none at the version.
  private static ReportText text(ResultSet rs, String prefix) throws SQLException {
    String text = rs.getString(prefix + "_text");
    if (text == null) {
      return null;
    }
    return new ReportText(text, rs.getInt(prefix + "_first_page"), rs.getInt(prefix + "_last_page"));
  }

  private record FindingKey(long reportId, String regulation) {}
}
