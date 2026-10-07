package ie.clearcare.api.centres;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ResponseStatusException;

/**
 * The checked parameters of GET /centres. A null field is a parameter that was not given.
 *
 * <p>name and address are not folded here: the query passes them to clearcare.search_key, so the
 * folding rule is written once, in db/V1.
 */
record CentreSearchParameters(
    String name, String address, String eircode, String county, int page, int pageSize) {

  private static final List<String> PARAMETERS =
      List.of("name", "address", "eircode", "county", "page", "page_size");
  private static final int MAX_TEXT_LENGTH = 100;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 50;

  // A routing key (W23, or D6W for Dublin 6W), optionally followed by the four characters that
  // make it a full Eircode. The letters are the ones Eircodes use, as in the CHECK on
  // register_entry.eircode in db/V1. O is not one of them, and is not read as 0.
  private static final Pattern EIRCODE =
      Pattern.compile("([AC-FHKNPRTV-Y][0-9]{2}|D6W)([0-9AC-FHKNPRTV-Y]{4})?");

  // As spelt in the County column of the register.
  private static final Set<String> COUNTIES =
      Set.of(
          "Carlow",
          "Cavan",
          "Clare",
          "Cork",
          "Donegal",
          "Dublin",
          "Galway",
          "Kerry",
          "Kildare",
          "Kilkenny",
          "Laois",
          "Leitrim",
          "Limerick",
          "Longford",
          "Louth",
          "Mayo",
          "Meath",
          "Monaghan",
          "Offaly",
          "Roscommon",
          "Sligo",
          "Tipperary",
          "Waterford",
          "Westmeath",
          "Wexford",
          "Wicklow");

  static CentreSearchParameters parse(MultiValueMap<String, String> query) {
    query.forEach(
        (key, values) -> {
          if (!PARAMETERS.contains(key)) {
            throw badRequest(
                key + " is not a parameter; use one of " + String.join(", ", PARAMETERS));
          }
          if (values.size() > 1) {
            throw badRequest(key + " must be given only once");
          }
        });
    return new CentreSearchParameters(
        text(query, "name"),
        text(query, "address"),
        eircode(query.getFirst("eircode")),
        county(query.getFirst("county")),
        positiveInteger(
            query.getFirst("page"),
            1,
            Integer.MAX_VALUE,
            "page must be a whole number of 1 or more"),
        positiveInteger(
            query.getFirst("page_size"),
            DEFAULT_PAGE_SIZE,
            MAX_PAGE_SIZE,
            "page_size must be between 1 and " + MAX_PAGE_SIZE));
  }

  private static String text(MultiValueMap<String, String> query, String key) {
    String value = query.getFirst(key);
    if (value == null) {
      return null;
    }
    if (value.length() > MAX_TEXT_LENGTH) {
      throw badRequest(key + " must be at most " + MAX_TEXT_LENGTH + " characters");
    }
    // PostgreSQL text cannot hold U+0000, so the query would fail.
    if (value.indexOf('\0') >= 0) {
      throw badRequest(key + " must not contain a NUL character");
    }
    return value;
  }

  // Stored Eircodes are upper case without spaces.
  private static String eircode(String value) {
    if (value == null) {
      return null;
    }
    String eircode = value.replace(" ", "").toUpperCase(Locale.ROOT);
    if (!EIRCODE.matcher(eircode).matches()) {
      throw badRequest(
          "eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX");
    }
    return eircode;
  }

  private static String county(String value) {
    if (value != null && !COUNTIES.contains(value)) {
      throw badRequest("county must be spelt as on the register, such as Dublin");
    }
    return value;
  }

  // A whole number from 1 to max.
  private static int positiveInteger(String value, int defaultValue, int max, String rule) {
    if (value == null) {
      return defaultValue;
    }
    int number;
    try {
      number = Integer.parseInt(value);
    } catch (NumberFormatException e) {
      throw badRequest(rule);
    }
    if (number < 1 || number > max) {
      throw badRequest(rule);
    }
    return number;
  }

  private static ResponseStatusException badRequest(String detail) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
  }
}
