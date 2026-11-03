package ie.clearcare.api.centres;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

/**
 * The item names of the four amenities-v2 lists, in the order of their enums in api/openapi.yaml.
 * The contract is the API's only copy of them: api/pom.xml puts it on the classpath, and
 * pipeline/tests/test_api_contract.py checks it against the extractor's lists.
 */
@Component
class AmenityItemNames {

  private final List<String> careTypes;
  private final List<String> roomTypes;
  private final List<String> activities;
  private final List<String> facilities;

  AmenityItemNames() throws IOException {
    Object contract;
    try (InputStream file = new ClassPathResource("openapi.yaml").getInputStream()) {
      contract = new Yaml().load(file);
    }
    careTypes = itemNames(contract, "CareTypeItem");
    roomTypes = itemNames(contract, "RoomTypeItem");
    activities = itemNames(contract, "ActivityItem");
    facilities = itemNames(contract, "FacilityItem");
  }

  List<String> careTypes() {
    return careTypes;
  }

  List<String> roomTypes() {
    return roomTypes;
  }

  List<String> activities() {
    return activities;
  }

  List<String> facilities() {
    return facilities;
  }

  private static List<String> itemNames(Object contract, String schema) {
    if (contract instanceof Map<?, ?> root
        && root.get("components") instanceof Map<?, ?> components
        && components.get("schemas") instanceof Map<?, ?> schemas
        && schemas.get(schema) instanceof Map<?, ?> itemSchema
        && itemSchema.get("enum") instanceof List<?> names
        && !names.isEmpty()
        && names.stream().allMatch(String.class::isInstance)) {
      return names.stream().map(String.class::cast).toList();
    }
    throw new IllegalStateException(
        "openapi.yaml must list the item names in components.schemas." + schema + ".enum");
  }
}
