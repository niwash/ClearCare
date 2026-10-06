package ie.clearcare.api.centres;

import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /centres, as described in api/openapi.yaml. */
@RestController
class CentreSearchController {

  private final CentreSearchRepository repository;

  CentreSearchController(CentreSearchRepository repository) {
    this.repository = repository;
  }

  // All the query parameters come in one map, so that unknown and repeated ones can be refused.
  @GetMapping("/centres")
  CentreSearchResult search(@RequestParam MultiValueMap<String, String> query) {
    CentreSearchParameters parameters = CentreSearchParameters.parse(query);
    return repository
        .search(parameters)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "The register has not been loaded yet."));
  }
}
