package ie.clearcare.api.centres;

import java.util.List;

/** One page of search results, and the register snapshot they were read from. */
record CentreSearchResult(
    List<Centre> centres, int page, int pageSize, long total, RegisterSnapshot registerSnapshot) {}
