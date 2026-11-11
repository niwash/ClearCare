package ie.clearcare.api.centres;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ResponseStatusException;

/**
 * The checked parameters of GET /centres. A null field is a parameter that was not given, and an
 * empty list an amenity filter that was not given.
 *
 * <p>near is where distances are measured from; sort=distance needs it.
 *
 * <p>name and address are not folded here: the query passes them to clearcare.search_key, so the
 * folding rule is written once, in db/V1.
 */
record CentreSearchParameters(
    String name,
    String address,
    String eircode,
    String county,
    List<String> careTypes,
    List<String> roomTypes,
    List<String> facilities,
    List<String> activities,
    Coordinates near,
    String sort,
    int page,
    int pageSize) {

  /** A latitude and longitude in degrees on WGS 84, as centre_location holds its points. */
  record Coordinates(double latitude, double longitude) {}

  private static final List<String> PARAMETERS =
      List.of(
          "name",
          "address",
          "eircode",
          "county",
          "care_type",
          "room_type",
          "facility",
          "activity",
          "near",
          "sort",
          "page",
          "page_size");
  // The amenity filters take one item name per value, so they may be repeated.
  private static final List<String> REPEATABLE =
      List.of("care_type", "room_type", "facility", "activity");
  private static final List<String> SORTS = List.of("name", "latest_inspection", "distance");
  private static final int MAX_TEXT_LENGTH = 100;
  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 50;

  // A routing key (W23, or D6W for Dublin 6W), optionally followed by the four characters that
  // make it a full Eircode. The letters are the ones Eircodes use, as in the CHECK on
  // register_entry.eircode in db/V1. O is not one of them: eircode() reads it as 0 when the
  // first three characters hold a digit.
  private static final Pattern EIRCODE =
      Pattern.compile("([AC-FHKNPRTV-Y][0-9]{2}|D6W)([0-9AC-FHKNPRTV-Y]{4})?");

  // Latitude,longitude, each with at most two decimal places. Two places are about 1 km, which is
  // as exact as ordering centres by distance needs. More are refused, so that no client is built
  // to send a visitor's exact location, which would stay in page addresses and logs.
  private static final Pattern NEAR =
      Pattern.compile("(-?[0-9]{1,3}(?:\\.[0-9]{1,2})?),(-?[0-9]{1,3}(?:\\.[0-9]{1,2})?)");

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

  static CentreSearchParameters parse(
      MultiValueMap<String, String> query, AmenityItemNames itemNames) {
    query.forEach(
        (key, values) -> {
          if (!PARAMETERS.contains(key)) {
            throw badRequest(
                key + " is not a parameter; use one of " + String.join(", ", PARAMETERS));
          }
          if (values.size() > 1 && !REPEATABLE.contains(key)) {
            throw badRequest(key + " must be given only once");
          }
        });
    CentreSearchParameters parameters =
        new CentreSearchParameters(
            text(query, "name"),
            text(query, "address"),
            eircode(query.getFirst("eircode")),
            county(query.getFirst("county")),
            amenityFilter(query, "care_type", itemNames.careTypes()),
            amenityFilter(query, "room_type", itemNames.roomTypes()),
            amenityFilter(query, "facility", itemNames.facilities()),
            amenityFilter(query, "activity", itemNames.activities()),
            near(query.getFirst("near")),
            sort(query.getFirst("sort")),
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
    if (parameters.sort().equals("distance") && parameters.near() == null) {
      throw badRequest("sort=distance needs near, such as near=53.35,-6.26");
    }
    return parameters;
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

  // Stored Eircodes are upper case without spaces. Eircodes leave the letter O out so that it
  // cannot be confused with a zero, so an O can only be a 0 typed as a letter. It is read so only
  // when the routing key, the first three characters, already holds a digit. Every routing key has
  // a digit that is not 0 (W23, D06, D6W), so an Eircode typed with O for 0 still shows one there,
  // while a word that starts with a letter and two Os, such as Doonane or Doonan1, stays a word.
  // The register load does the same (_eircode in
  // pipeline/src/clearcare_pipeline/load_register/register_csv.py).
  private static String eircode(String value) {
    if (value == null) {
      return null;
    }
    String eircode = value.replace(" ", "").toUpperCase(Locale.ROOT);
    String routingKey = eircode.substring(0, Math.min(eircode.length(), 3));
    if (routingKey.chars().anyMatch(character -> character >= '0' && character <= '9')) {
      eircode = eircode.replace('O', '0');
    }
    if (!EIRCODE.matcher(eircode).matches()) {
      throw badRequest(
          "eircode must be a routing key such as W23 or a full Eircode such as W23 P6EX");
    }
    return eircode;
  }

  private static Coordinates near(String value) {
    if (value == null) {
      return null;
    }
    Matcher matcher = NEAR.matcher(value);
    if (matcher.matches()) {
      double latitude = Double.parseDouble(matcher.group(1));
      double longitude = Double.parseDouble(matcher.group(2));
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        return new Coordinates(latitude, longitude);
      }
    }
    throw badRequest(
        "near must be a latitude from -90 to 90 and a longitude from -180 to 180 in degrees, with"
            + " at most two decimal places, such as 53.35,-6.26");
  }

  private static String county(String value) {
    if (value != null && !COUNTIES.contains(value)) {
      throw badRequest("county must be spelt as on the register, such as Dublin");
    }
    return value;
  }

  // Exact names from one amenities-v2 list. A name given twice counts once.
  private static List<String> amenityFilter(
      MultiValueMap<String, String> query, String key, List<String> names) {
    List<String> values = query.getOrDefault(key, List.of());
    for (String value : values) {
      if (!names.contains(value)) {
        throw badRequest(
            key + " must be an item name from the amenities-v2 list, such as " + names.getFirst());
      }
    }
    return values.stream().distinct().toList();
  }

  private static String sort(String value) {
    if (value == null) {
      return "name";
    }
    if (!SORTS.contains(value)) {
      throw badRequest("sort must be name, latest_inspection or distance");
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
