package ie.clearcare.api.centres;

import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /centres and GET /centres/{centre_id}, as described in api/openapi.yaml. */
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
    return repository.search(parameters).orElseThrow(CentreSearchController::registerNotLoaded);
  }

  // centre_id is not checked against the ID pattern: a value that is not an ID is not in the
  // snapshot either, so it gets the same 404.
  @GetMapping("/centres/{centre_id}")
  CentreResult get(@PathVariable("centre_id") String centreId) {
    CentreResult result =
        repository.find(centreId).orElseThrow(CentreSearchController::registerNotLoaded);
    if (result.centre() == null) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "The register has no centre with this centre_id.");
    }
    return result;
  }

  private static ResponseStatusException registerNotLoaded() {
    return new ResponseStatusException(
        HttpStatus.SERVICE_UNAVAILABLE, "The register has not been loaded yet.");
  }
}
