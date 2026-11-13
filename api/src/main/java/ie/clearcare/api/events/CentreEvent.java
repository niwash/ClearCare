package ie.clearcare.api.events;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.annotation.JsonTypeName;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One event of a centre's record, as GET /centres/{centre_id}/events returns it: a kind, a date and
 * that kind's fields (ADR-0033). There is one record per kind, and its type name is the kind, which
 * JSON carries as "kind". An event holds no sentence: the page writes the words.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
sealed interface CentreEvent {

  /**
   * The day of the event. Null only for a report whose inspection date is not known: it was not
   * read, and the date HIQA lists for it cannot be right.
   */
  LocalDate date();

  /** The day the event's report was published. Null for an event that has no report. */
  default LocalDate publishedDate() {
    return null;
  }

  /**
   * A regulation inspection whose report was read. The counts are of judgments, one per regulation.
   * publishedDate is null when HIQA no longer lists the report.
   */
  @JsonTypeName("inspection")
  record Inspection(
      LocalDate date,
      String inspectionType,
      LocalDate publishedDate,
      long reportId,
      String reportUrl,
      long compliant,
      long substantiallyCompliant,
      long notCompliant)
      implements CentreEvent {}

  /** A thematic inspection whose report was read, with its overall judgment as printed. */
  @JsonTypeName("thematic_inspection")
  record ThematicInspection(
      LocalDate date,
      String inspectionType,
      LocalDate publishedDate,
      String overallJudgment,
      String reportUrl)
      implements CentreEvent {}

  /** A report HIQA lists that ClearCare holds no reading of. date is the listed one. */
  @JsonTypeName("unread_report")
  record UnreadReport(LocalDate date, LocalDate publishedDate, String reportUrl)
      implements CentreEvent {}

  /** A registration, dated by its own date. The other register changes are dated by the day the
   * register first showed them (ADR-0031). */
  @JsonTypeName("registration")
  record Registration(LocalDate date, LocalDate registeredUntil) implements CentreEvent {}

  /** A new registered provider. A side is null when that provider has no CRO number. */
  @JsonTypeName("provider")
  record ProviderChange(LocalDate date, String before, String after) implements CentreEvent {}

  @JsonTypeName("name")
  record NameChange(LocalDate date, String before, String after) implements CentreEvent {}

  /** A change of maximum occupancy. A side is null when the register gave no number. */
  @JsonTypeName("beds")
  record BedsChange(LocalDate date, Integer before, Integer after) implements CentreEvent {}

  @JsonTypeName("condition_added")
  record ConditionAdded(LocalDate date, int conditionNumber, String text)
      implements CentreEvent {}

  /** text is the condition as it was before it was removed. */
  @JsonTypeName("condition_removed")
  record ConditionRemoved(LocalDate date, int conditionNumber, String text)
      implements CentreEvent {}

  @JsonTypeName("condition_changed")
  record ConditionChanged(LocalDate date, int conditionNumber, String before, String after)
      implements CentreEvent {}

  @JsonTypeName("note_added")
  record NoteAdded(LocalDate date, String text) implements CentreEvent {}

  /** text is the Chief Inspector's note as it was before it was removed. */
  @JsonTypeName("note_removed")
  record NoteRemoved(LocalDate date, String text) implements CentreEvent {}

  /** A contract price that differs from the centre's price in the list before. */
  @JsonTypeName("price")
  record PriceChange(LocalDate date, BigDecimal before, BigDecimal after, String homeType)
      implements CentreEvent {}
}
