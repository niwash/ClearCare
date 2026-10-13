package ie.clearcare.api.reports;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Reads inspection reports from the views the clearcare_api role can read (db/V3). */
@Repository
class CentreReportsRepository {

  // The register's views (db/V1). Reports are served only for a centre the register snapshot has,
  // and only once a snapshot has been published.
  private static final String REGISTER_SNAPSHOT =
      "SELECT 1 FROM clearcare.published_register_snapshot";

  private static final String CENTRE =
      "SELECT 1 FROM clearcare.centre_search WHERE centre_id = :centre_id";

  // A report is listed with how much it holds; the report itself is fetched by report_id. Newest
  // inspection first, then by report_id so that reports with no date have a stable order.
  private static final String REPORTS =
      """
      SELECT
          report_id,
          inspection_type,
          inspection_date,
          fieldwork_id,
          residents,
          (SELECT count(*) FROM clearcare.report_inspector
           WHERE report_id = centre_report.report_id) AS inspector_count,
          (SELECT count(*) FROM clearcare.report_regulation
           WHERE report_id = centre_report.report_id) AS regulation_count,
          (SELECT count(*) FROM clearcare.report_compliance_item
           WHERE report_id = centre_report.report_id) AS compliance_item_count
      FROM clearcare.centre_report
      WHERE centre_id = :centre_id
      ORDER BY inspection_date DESC NULLS LAST, report_id
      """;

  private static final String REPORT =
      """
      SELECT report_id, centre_id, centre_code, centre_name, provider_name, address,
             inspection_type, inspection_date, fieldwork_id, residents,
             report_sha256, report_url, report_fetched_at
      FROM clearcare.centre_report
      WHERE report_id = :report_id
      """;

  // The record groups, in the order the report prints them: the id is the insertion order.
  private static final String INSPECTORS =
      """
      SELECT date, start_time, end_time, name, role
      FROM clearcare.report_inspector
      WHERE report_id = :report_id
      ORDER BY id
      """;

  private static final String REGULATIONS =
      """
      SELECT regulation, title, judgment
      FROM clearcare.report_regulation
      WHERE report_id = :report_id
      ORDER BY id
      """;

  private static final String COMPLIANCE_ITEMS =
      """
      SELECT regulation, requirement, judgment, risk_rating, date_to_comply
      FROM clearcare.report_compliance_item
      WHERE report_id = :report_id
      ORDER BY id
      """;

  private final JdbcClient jdbc;

  CentreReportsRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Returns the reports ClearCare has loaded for this centre, or nothing if no register snapshot
   * has been published. reports is null if the snapshot does not have the centre. The centre and
   * its reports are read in one transaction, so they agree even if a register is loaded meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreReportsResult> findReports(String centreId) {
    if (!registerPublished()) {
      return Optional.empty();
    }
    if (!centreExists(centreId)) {
      return Optional.of(new CentreReportsResult(centreId, null));
    }
    return Optional.of(new CentreReportsResult(centreId, reports(centreId)));
  }

  /**
   * Returns the report with this report_id and everything it printed, or nothing if there is none.
   * The report and its record groups are read in one transaction, so they agree.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<ReportResult> findReport(long reportId) {
    Optional<ReportHeader> header =
        jdbc.sql(REPORT).param("report_id", reportId).query(ReportHeader.class).optional();
    return header.map(value -> new ReportResult(detail(value)));
  }

  private boolean registerPublished() {
    return jdbc.sql(REGISTER_SNAPSHOT).query(Integer.class).optional().isPresent();
  }

  private boolean centreExists(String centreId) {
    return jdbc.sql(CENTRE).param("centre_id", centreId).query(Integer.class).optional().isPresent();
  }

  private List<CentreReport> reports(String centreId) {
    return jdbc.sql(REPORTS).param("centre_id", centreId).query(CentreReport.class).list();
  }

  private ReportDetail detail(ReportHeader header) {
    long reportId = header.reportId();
    return new ReportDetail(
        reportId,
        header.centreId(),
        header.centreCode(),
        header.centreName(),
        header.providerName(),
        header.address(),
        header.inspectionType(),
        header.inspectionDate(),
        header.fieldworkId(),
        header.residents(),
        // The API gives fetched_at to the second, as it does the register snapshot.
        new ReportFile(
            header.reportFetchedAt().toInstant().truncatedTo(ChronoUnit.SECONDS),
            header.reportUrl(),
            header.reportSha256()),
        jdbc.sql(INSPECTORS).param("report_id", reportId).query(ReportInspector.class).list(),
        jdbc.sql(REGULATIONS).param("report_id", reportId).query(ReportRegulation.class).list(),
        jdbc.sql(COMPLIANCE_ITEMS)
            .param("report_id", reportId)
            .query(ReportComplianceItem.class)
            .list());
  }
}
