package ie.clearcare.api.statistics;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Counts the rows of clearcare.next_inspection_result (db/V4) and the loaded reports (db/V3). */
@Repository
class ReAssessmentRepository {

  // The view passes judgments on as printed (ADR-0015), so only these three spellings are counted
  // in a column. total counts every judgment of the row. The starting judgments are listed here,
  // rather than read from the view, so that each always has a row, in this order.
  private static final String MATRIX =
      """
      SELECT
          starting.judgment,
          count(*) FILTER (WHERE next_result = 'Compliant') AS compliant,
          count(*) FILTER (WHERE next_result = 'Substantially compliant')
              AS substantially_compliant,
          count(*) FILTER (WHERE next_result = 'Not compliant') AS not_compliant,
          count(*) FILTER (WHERE next_result = 'not re-assessed') AS not_re_assessed,
          count(*) FILTER (WHERE next_result = 'no later report') AS no_later_report,
          count(next_result) AS total
      FROM (VALUES (1, 'Compliant'), (2, 'Substantially compliant'), (3, 'Not compliant'))
          AS starting (position, judgment)
      LEFT JOIN clearcare.next_inspection_result USING (judgment)
      GROUP BY starting.position, starting.judgment
      ORDER BY starting.position
      """;

  // A report that judged no regulation has no rows in the view, so it is not counted as paired.
  private static final String COVERAGE =
      """
      SELECT
          (SELECT count(*) FROM clearcare.centre_report) AS reports_loaded,
          (SELECT count(*) FROM (
               SELECT centre_id FROM clearcare.centre_report
               GROUP BY centre_id
               HAVING count(*) >= 2
           ) AS centre) AS centres_with_two_or_more_reports,
          (SELECT count(DISTINCT report_id) FROM clearcare.next_inspection_result
           WHERE next_report_id IS NOT NULL) AS reports_paired,
          (SELECT count(*) FROM clearcare.next_inspection_result
           WHERE next_report_id IS NOT NULL) AS judgments_paired
      """;

  private static final String DATA_DATE =
      "SELECT max(inspection_date) FROM clearcare.centre_report";

  // The statistics depend only on the loaded reports and their judgments. The pipeline only adds
  // reports, each with its judgments in the same transaction (db/V2), and a report_id is never
  // used twice, so this changes whenever the statistics can.
  private static final String FINGERPRINT =
      "SELECT count(*) AS reports, max(report_id) AS last_report_id FROM clearcare.centre_report";

  private record Fingerprint(long reports, Long lastReportId) {}

  private record Kept(Fingerprint fingerprint, Optional<ReAssessmentStatistics> statistics) {}

  private final JdbcClient jdbc;

  // Counting takes about 0.6 s on AWS with the national data, and the home page asks for the
  // statistics on every visit. Two calls that miss at once may both count, and either pair may be
  // kept: each result still belongs to its own fingerprint.
  private volatile Kept kept;

  ReAssessmentRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /**
   * Returns the statistics, or nothing until a report with an inspection date has been loaded: a
   * report without one cannot be paired (ADR-0015). The result is kept until other reports are
   * loaded. Everything is read in one transaction, so the parts agree, and a kept result belongs
   * to its fingerprint, even if reports are loaded meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<ReAssessmentStatistics> find() {
    Fingerprint fingerprint = jdbc.sql(FINGERPRINT).query(Fingerprint.class).single();
    Kept last = kept;
    if (last != null && last.fingerprint().equals(fingerprint)) {
      return last.statistics();
    }
    Optional<ReAssessmentStatistics> statistics = count();
    kept = new Kept(fingerprint, statistics);
    return statistics;
  }

  private Optional<ReAssessmentStatistics> count() {
    Optional<LocalDate> dataDate = jdbc.sql(DATA_DATE).query(LocalDate.class).optional();
    if (dataDate.isEmpty()) {
      return Optional.empty();
    }
    List<NextResultCounts> matrix = jdbc.sql(MATRIX).query(NextResultCounts.class).list();
    return Optional.of(
        new ReAssessmentStatistics(
            matrix,
            matrix.stream().map(ReCheckRate::from).toList(),
            jdbc.sql(COVERAGE).query(Coverage.class).single(),
            dataDate.get()));
  }
}
