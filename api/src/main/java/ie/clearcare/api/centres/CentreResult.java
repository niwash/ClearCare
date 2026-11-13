package ie.clearcare.api.centres;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One centre, the register snapshot it was read from, the contract price in force for it and its
 * registration in that snapshot.
 *
 * <p>contractPrice is the latest published price, in euro per resident per week, homeType is the
 * kind of home that price is for, "public" or "private", and contractPriceDate is the date of the
 * list it came from. All three are null when no price list has been loaded for the centre.
 *
 * <p>registration is null when the snapshot was loaded before db/V21, which then has no extra
 * conditions either. chiefInspectorNote is null when the register gives none.
 */
record CentreResult(
    CentreDetail centre,
    RegisterSnapshot registerSnapshot,
    BigDecimal contractPrice,
    String homeType,
    LocalDate contractPriceDate,
    Registration registration,
    List<ExtraCondition> extraConditions,
    String chiefInspectorNote) {}
