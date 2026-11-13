package ie.clearcare.api.events;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /centres/{centre_id}/events, as described in api/openapi.yaml. */
@RestController
class CentreEventsController {

  private final CentreEventsRepository repository;

  CentreEventsController(CentreEventsRepository repository) {
    this.repository = repository;
  }

  // centre_id is not checked against the ID pattern: a value that is not an ID is not in the
  // snapshot either, so it gets the same 404.
  @GetMapping("/centres/{centre_id}/events")
  CentreEventsResult list(@PathVariable("centre_id") String centreId) {
    CentreEventsResult result =
        repository.findEvents(centreId).orElseThrow(CentreEventsController::registerNotLoaded);
    if (result.events() == null) {
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
