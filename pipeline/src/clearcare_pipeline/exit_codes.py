"""The exit codes a stage returns, and what the schedule makes of them.

One run's exit code is what ECS and the stopped-task alarm act on (ADR-0022),
so a stage's answer has to distinguish "the pipeline is broken" from "the
data has a gap this version cannot close yet". The second is normal: some
report layouts cannot be loaded (ADR-0013), and a HIQA report may have no
response for a regulation. Those are retried the next time the stage runs and
must not page anyone every night.
"""

# The stage did its part and everything it looked at worked.
EXIT_DONE = 0

# The stage could not do its part at all: a database error, a manifest it
# cannot read, a page it cannot parse. The run failed.
EXIT_FAILED = 1

# The stage did its part except for work it counted and left to the next run:
# a crawl HIQA would not answer, a layout this version cannot read, a response
# the source does not have. The run is recorded as incomplete and stays green.
EXIT_RETRY = 3
