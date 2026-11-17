package ie.clearcare.api.centres;

import java.util.List;

/**
 * One page of search results, the register snapshot they were read from, the facets of all the
 * matching centres, and the order applied.
 */
record CentreSearchResult(
    List<CentreSummary> centres,
    int page,
    int pageSize,
    long total,
    RegisterSnapshot registerSnapshot,
    Facets facets,
    String sort) {}
