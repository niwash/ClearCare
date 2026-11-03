package ie.clearcare.api.amenities;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /centres/{centre_id}/amenities, as described in api/openapi.yaml. */
@RestController
class CentreAmenitiesController {

  private final CentreAmenitiesRepository repository;

  CentreAmenitiesController(CentreAmenitiesRepository repository) {
    this.repository = repository;
  }

  // centre_id is not checked against the ID pattern: a value that is not an ID is not a centre
  // either, so it gets the same 404 as one the register does not have.
  @GetMapping("/centres/{centre_id}/amenities")
  CentreAmenitiesResult get(@PathVariable("centre_id") String centreId) {
    CentreAmenitiesLookup lookup =
        repository
            .find(centreId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "The register has not been loaded yet."));
    if (!lookup.centreFound()) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "The register has no centre with this centre_id.");
    }
    return new CentreAmenitiesResult(centreId, lookup.amenities());
  }
}
