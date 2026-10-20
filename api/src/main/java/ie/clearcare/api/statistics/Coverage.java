package ie.clearcare.api.statistics;

/** How much of the data the statistics rest on: the reports loaded and how many could be paired. */
record Coverage(
    long reportsLoaded,
    long centresWithTwoOrMoreReports,
    long reportsPaired,
    long judgmentsPaired) {}
