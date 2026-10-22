"""The append-only manifest of price list downloads.

Its lines are snapshot records (snapshots/snapshot.py), one per list per
download, named by the list's source_file source.
"""

MANIFEST_NAME = "price-lists.jsonl"
