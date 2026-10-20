package ie.clearcare.api.reports;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * GET /centres/{centre_id}/reports and GET /reports/{report_id}, as described in api/openapi.yaml.
 */
@RestController
class CentreReportsController {

  private final CentreReportsRepository repository;

  CentreReportsController(CentreReportsRepository repository) {
    this.repository = repository;
  }

  @GetMapping("/centres/{centre_id}/reports")
  CentreReportsResult list(@PathVariable("centre_id") String centreId) {
    CentreReportsResult result =
        repository.findReports(centreId).orElseThrow(CentreReportsController::registerNotLoaded);
    if (result.reports() == null) {
      throw new ResponseStatusException(
          HttpStatus.NOT_FOUND, "The register has no centre with this centre_id.");
    }
    return result;
  }

  // report_id is not checked against the ID pattern: a value that is not an ID is not a report
  // either, so it gets the same 404.
  @GetMapping("/reports/{report_id}")
  ReportResult get(@PathVariable("report_id") String reportId) {
    return repository
        .findReport(number(reportId))
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "There is no report with this report_id."));
  }

  private static long number(String value) {
    try {
      return Long.parseLong(value);
    } catch (NumberFormatException e) {
      return -1;
    }
  }

  private static ResponseStatusException registerNotLoaded() {
    return new ResponseStatusException(
        HttpStatus.SERVICE_UNAVAILABLE, "The register has not been loaded yet.");
  }
}
