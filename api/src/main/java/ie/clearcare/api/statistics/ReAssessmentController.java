package ie.clearcare.api.statistics;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** GET /statistics/re-assessment, as described in api/openapi.yaml. */
@RestController
class ReAssessmentController {

  private final ReAssessmentRepository repository;

  ReAssessmentController(ReAssessmentRepository repository) {
    this.repository = repository;
  }

  @GetMapping("/statistics/re-assessment")
  ReAssessmentStatistics get() {
    return repository
        .find()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "No inspection reports have been loaded yet."));
  }
}
