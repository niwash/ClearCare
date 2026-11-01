"""The exit codes a stage returns, and what the schedule makes of them.

One run's exit code is what ECS and the stopped-task alarm act on (ADR-0021),
so a stage's answer has to distinguish "the pipeline is broken" from "the
data has a gap this version cannot close yet". The second is normal: some
report layouts cannot be loaded (ADR-0013), and a HIQA report may have no
response for a regulation. Those are retried the next time the stage runs and
must not page anyone every night.
"""

# The stage did its part and everything it looked at worked.
EXIT_DONE = 0

# The stage could not do its part: a database error, a file it could not read,
# nothing loaded at all. The run failed.
EXIT_FAILED = 1

# The stage read part of what it was given, but some of it could not be
# understood or is missing from the source. Its rows are written; the gaps
# are counted and logged, and the next run tries them again.
EXIT_RETRY = 3
