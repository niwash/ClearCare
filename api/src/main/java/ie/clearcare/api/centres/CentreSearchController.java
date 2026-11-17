package ie.clearcare.api.centres;

import org.springframework.http.HttpStatus;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import ie.clearcare.api.security.SiteToken;

/**
 * GET /centres, GET /centres/points and GET /centres/{centre_id}, as described in api/openapi.yaml.
 */
@RestController
class CentreSearchController {

  private final CentreSearchRepository repository;
  private final AmenityItemNames itemNames;
  private final SiteToken token;

  CentreSearchController(
      CentreSearchRepository repository, AmenityItemNames itemNames, SiteToken token) {
    this.repository = repository;
    this.itemNames = itemNames;
    this.token = token;
  }

  // All the query parameters come in one map, so that unknown and repeated ones can be refused.
  @GetMapping("/centres")
  CentreSearchResult search(@RequestParam MultiValueMap<String, String> query) {
    CentreSearchParameters parameters = CentreSearchParameters.parse(query, itemNames);
    return repository.search(parameters).orElseThrow(CentreSearchController::registerNotLoaded);
  }

  // Only the site's server may ask: the points are Google's coordinates, which the public API does
  // not give out (ADR-0029). The token is checked before the parameters, so that a request that is
  // not the site's learns nothing from a 400.
  @GetMapping("/centres/points")
  CentrePointsResult points(
      @RequestHeader(name = "X-ClearCare-Token", required = false) String caller,
      @RequestParam MultiValueMap<String, String> query) {
    token.requireSite(caller);
    CentreSearchParameters parameters = CentreSearchParameters.parsePoints(query, itemNames);
    return repository.points(parameters).orElseThrow(CentreSearchController::registerNotLoaded);
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
