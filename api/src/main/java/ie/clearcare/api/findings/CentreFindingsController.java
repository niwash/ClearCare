package ie.clearcare.api.findings;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /centres/{centre_id}/findings, as described in api/openapi.yaml. */
@RestController
class CentreFindingsController {

  private final CentreFindingsRepository repository;

  CentreFindingsController(CentreFindingsRepository repository) {
    this.repository = repository;
  }

  // centre_id is not checked against the ID pattern: a value that is not an ID is not a centre
  // either, so it gets the same 404 as one the register does not have.
  @GetMapping("/centres/{centre_id}/findings")
  CentreFindingsResult list(@PathVariable("centre_id") String centreId) {
    CentreFindingsResult result =
        repository
            .findFindings(centreId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "The register has not been loaded yet."));
    if (result.findings() == null) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "The register has no centre with this centre_id.");
    }
    return result;
  }
}
