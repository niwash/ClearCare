package ie.clearcare.api.events;

import ie.clearcare.api.centres.CentreRegisterChecks;
import ie.clearcare.api.events.CentreEvent.BedsChange;
import ie.clearcare.api.events.CentreEvent.ConditionAdded;
import ie.clearcare.api.events.CentreEvent.ConditionChanged;
import ie.clearcare.api.events.CentreEvent.ConditionRemoved;
import ie.clearcare.api.events.CentreEvent.Inspection;
import ie.clearcare.api.events.CentreEvent.NameChange;
import ie.clearcare.api.events.CentreEvent.NoteAdded;
import ie.clearcare.api.events.CentreEvent.NoteRemoved;
import ie.clearcare.api.events.CentreEvent.PriceChange;
import ie.clearcare.api.events.CentreEvent.ProviderChange;
import ie.clearcare.api.events.CentreEvent.Registration;
import ie.clearcare.api.events.CentreEvent.ThematicInspection;
import ie.clearcare.api.events.CentreEvent.UnreadReport;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Reads a centre's events from the views the clearcare_api role can read (db/V24). */
@Repository
class CentreEventsRepository {

  // db/V21 keeps the rows of every version of the rules side by side, and defines no order
  // between versions, so the served one changes when the differ's RULES_VERSION does.
  private static final String RULES_VERSION = "rules-v1";

  // Each query has an order of its own, which the sort below keeps for events of one kind on one
  // day, so the same request gives the same order every time.
  private static final String INSPECTIONS =
      """
      SELECT inspection_kind, inspection_date, published_date, inspection_type, report_id,
          report_url, compliant, substantially_compliant, not_compliant, overall_judgment
      FROM clearcare.centre_inspection
      WHERE centre_id = :centre_id
      ORDER BY report_url
      """;

  private static final String REGISTER_CHANGES =
      """
      SELECT kind, change_date, condition_number, before_text, after_text, beds_before,
          beds_after, registered_until
      FROM clearcare.centre_register_change
      WHERE centre_id = :centre_id AND rules_version = :rules_version
      ORDER BY condition_number NULLS FIRST, register_change_id
      """;

  // Two changes of one date are two versions of that date's list: the later version first.
  private static final String PRICE_CHANGES =
      """
      SELECT record_date, price_before, price_after, home_type
      FROM clearcare.centre_price_change
      WHERE centre_id = :centre_id
      ORDER BY version DESC
      """;

  // The order of the kinds on one day: what an inspector found, then the register changes in the
  // order of the register's columns, then the price.
  private static final List<Class<? extends CentreEvent>> KINDS_ON_ONE_DAY =
      List.of(
          Inspection.class,
          ThematicInspection.class,
          UnreadReport.class,
          Registration.class,
          ProviderChange.class,
          NameChange.class,
          BedsChange.class,
          ConditionAdded.class,
          ConditionChanged.class,
          ConditionRemoved.class,
          NoteAdded.class,
          NoteRemoved.class,
          PriceChange.class);

  // Newest first. An event with no date is placed by the day its report was published.
  private static final Comparator<CentreEvent> NEWEST_FIRST =
      Comparator.comparing(
              (CentreEvent event) -> event.date() != null ? event.date() : event.publishedDate(),
              Comparator.nullsLast(Comparator.reverseOrder()))
          .thenComparing(event -> KINDS_ON_ONE_DAY.indexOf(event.getClass()));

  private final JdbcClient jdbc;
  private final CentreRegisterChecks register;

  CentreEventsRepository(JdbcClient jdbc, CentreRegisterChecks register) {
    this.jdbc = jdbc;
    this.register = register;
  }

  /**
   * Returns the centre's events, newest first, or nothing if no register snapshot has been
   * published. events is null if the snapshot does not have the centre. The centre and its events
   * are read in one transaction, so they agree even if the pipeline loads something meanwhile.
   */
  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  Optional<CentreEventsResult> findEvents(String centreId) {
    if (!register.registerPublished()) {
      return Optional.empty();
    }
    if (!register.centreExists(centreId)) {
      return Optional.of(new CentreEventsResult(centreId, null));
    }
    List<CentreEvent> events = new ArrayList<>();
    events.addAll(
        jdbc.sql(INSPECTIONS)
            .param("centre_id", centreId)
            .query(CentreEventsRepository::inspection)
            .list());
    events.addAll(
        jdbc.sql(REGISTER_CHANGES)
            .param("centre_id", centreId)
            .param("rules_version", RULES_VERSION)
            .query(CentreEventsRepository::registerChange)
            .list());
    events.addAll(
        jdbc.sql(PRICE_CHANGES)
            .param("centre_id", centreId)
            .query(CentreEventsRepository::priceChange)
            .list());
    // The sort is stable, so events that compare equal stay in their query's order.
    events.sort(NEWEST_FIRST);
    return Optional.of(new CentreEventsResult(centreId, events));
  }

  private static CentreEvent inspection(ResultSet row, int rowNumber) throws SQLException {
    LocalDate date = row.getObject("inspection_date", LocalDate.class);
    LocalDate publishedDate = row.getObject("published_date", LocalDate.class);
    String reportUrl = row.getString("report_url");
    String inspectionKind = row.getString("inspection_kind");
    if (inspectionKind == null) {
      return new UnreadReport(date, publishedDate, reportUrl);
    }
    return switch (inspectionKind) {
      case "regulation inspection" ->
          new Inspection(
              date,
              row.getString("inspection_type"),
              publishedDate,
              row.getLong("report_id"),
              reportUrl,
              row.getLong("compliant"),
              row.getLong("substantially_compliant"),
              row.getLong("not_compliant"));
      case "thematic inspection" ->
          new ThematicInspection(
              date,
              row.getString("inspection_type"),
              publishedDate,
              row.getString("overall_judgment"),
              reportUrl);
      default ->
          throw new IllegalStateException(
              "clearcare.centre_inspection has the inspection_kind '"
                  + inspectionKind
                  + "'; expected 'regulation inspection', 'thematic inspection' or NULL.");
    };
  }

  // The stored row has one column per field, and each kind uses its own (db/V21).
  private static CentreEvent registerChange(ResultSet row, int rowNumber) throws SQLException {
    LocalDate date = row.getObject("change_date", LocalDate.class);
    String before = row.getString("before_text");
    String after = row.getString("after_text");
    String kind = row.getString("kind");
    return switch (kind) {
      case "registration" ->
          new Registration(date, row.getObject("registered_until", LocalDate.class));
      case "provider" -> new ProviderChange(date, before, after);
      case "name" -> new NameChange(date, before, after);
      case "beds" ->
          new BedsChange(
              date,
              row.getObject("beds_before", Integer.class),
              row.getObject("beds_after", Integer.class));
      case "condition_added" -> new ConditionAdded(date, row.getInt("condition_number"), after);
      case "condition_removed" ->
          new ConditionRemoved(date, row.getInt("condition_number"), before);
      case "condition_changed" ->
          new ConditionChanged(date, row.getInt("condition_number"), before, after);
      case "note_added" -> new NoteAdded(date, after);
      case "note_removed" -> new NoteRemoved(date, before);
      default ->
          throw new IllegalStateException(
              "clearcare.centre_register_change has the kind '"
                  + kind
                  + "'; expected one of the nine kinds db/V21 allows.");
    };
  }

  private static CentreEvent priceChange(ResultSet row, int rowNumber) throws SQLException {
    return new PriceChange(
        row.getObject("record_date", LocalDate.class),
        row.getBigDecimal("price_before"),
        row.getBigDecimal("price_after"),
        row.getString("home_type"));
  }
}
