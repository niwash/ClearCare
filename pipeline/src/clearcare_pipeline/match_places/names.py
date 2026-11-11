"""Comparing a register name with Google's name for the same centre.

Two comparisons, either of which is enough. Irish names vary more in spelling
than in wording, so a word-only test loses homes that a spelling test keeps:
"Beechlawn" against "Beech Lawn", "Aras Gaoth Dobhair" against "Aras Ghaoth
Dobhair", "Caherciveen" against "Cahirciveen".

The thresholds were measured across all 546 centres in the register, and the
number of centres the pipeline approves depends on them, so change one only
with that assessment in hand (ADR-0030, CCARE-209's proposal).
"""

import difflib
import re
import unicodedata

# Two names are the same name if they are this alike as characters ...
SPELLING_THRESHOLD = 0.70
# ... or if this much of their distinctive vocabulary is shared.
WORDS_THRESHOLD = 0.60

# The article, company suffixes, and the words nearly every centre has. They
# say nothing about which centre this is, so both comparisons drop them.
# Removing them is what lets "Mount Cara Nursing Home" match "Mount Cara".
GENERIC_WORDS = frozenset(
    {
        "and",
        "care",
        "center",
        "centre",
        "clg",
        "co",
        "community",
        "company",
        "dac",
        "health",
        "home",
        "hospital",
        "house",
        "limited",
        "ltd",
        "nursing",
        "plc",
        "private",
        "residential",
        "services",
        "the",
        "unit",
        "unlimited",
    }
)


def spelling_similarity(left: str, right: str) -> float:
    """How alike two names are, character by character, 0 to 1.

    Catches what word overlap cannot see: a name split in two, an apostrophe,
    an anglicised spelling, or an Irish initial mutation.
    """
    first, second = _canonical(left), _canonical(right)
    if not first or not second:
        # SequenceMatcher calls two empty strings identical, which would make
        # a missing name agree with a missing name.
        return 0.0
    return difflib.SequenceMatcher(None, first, second).ratio()


def word_overlap(left: str, right: str) -> float:
    """How much of the distinctive vocabulary two names share, 0 to 1."""
    first, second = _distinctive(left), _distinctive(right)
    if not first or not second:
        return 0.0
    return len(first & second) / len(first | second)


def agrees(left: str, right: str) -> bool:
    """Whether two names name the same centre, by either comparison."""
    return (
        spelling_similarity(left, right) >= SPELLING_THRESHOLD
        or word_overlap(left, right) >= WORDS_THRESHOLD
    )


def _folded(value: str) -> str:
    """Lower case ASCII, with punctuation reduced to single spaces."""
    text = (value or "").replace("&", " and ")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def _canonical(value: str) -> str:
    """The name without the article or a company suffix."""
    return " ".join(
        word
        for word in _folded(value).split()
        if word
        not in {
            "the",
            "ltd",
            "limited",
            "unlimited",
            "company",
            "co",
            "plc",
            "dac",
            "clg",
        }
    )


def _distinctive(value: str) -> frozenset[str]:
    """The words that identify this centre rather than any centre."""
    return frozenset(
        word for word in _folded(value).split() if word not in GENERIC_WORDS
    )
