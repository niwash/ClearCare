package ie.clearcare.api.centres;

import java.math.BigDecimal;

/**
 * One centre, the register snapshot it was read from, and the contract price in force for it.
 *
 * <p>contractPrice is the latest published price, in euro per resident per week, and is null when
 * no price list has been loaded for the centre.
 */
record CentreResult(
    CentreDetail centre, RegisterSnapshot registerSnapshot, BigDecimal contractPrice) {}
