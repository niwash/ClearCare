"""Apply the landmark list's selection rules to every town in the Republic of Ireland.

Run with: python check_rules.py

Or, with the two sources already downloaded (as with curl, from the addresses below):
python check_rules.py f1015.json bua.json

It reads two CSO sources and prints the places the rules pick, and how that differs from the list
in how-places-were-chosen.md:

- Table F1015 (Census 2022, population by town), for each town's population and county.
- The CSO's Census 2022 Built Up Areas map layer, for where each town is (the middle of its area).

Python 3.9 or later, standard library only.
"""

from __future__ import annotations

import json
import math
import re
import sys
import urllib.request
from pathlib import Path

# The rules' two numbers (see how-places-were-chosen.md).
LARGE_TOWN = 5000  # rule 3: every town with at least this many people
COVERAGE_TOWN = 1500  # rule 4: a town with at least this many people...
COVERAGE_KM = 20  # ...more than this far from every place already picked

F1015 = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F1015/JSON-stat/2.0/en"
BUA = (
    "https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/arcgis/rest/services/CensusHub2022_T1_2_BUA/"
    "FeatureServer/0/query?where=1%3D1&outFields=BUA_NAME,T1_2T&returnGeometry=false"
    "&returnCentroid=true&outSR=4326&resultRecordCount=2000&f=json"
)

# Rule 1: the six cities, by their CSO names.
CITIES = [
    "Dublin city and suburbs",
    "Cork city and suburbs",
    "Limerick city and suburbs",
    "Galway city and suburbs",
    "Waterford city and suburbs",
    "Kilkenny",
]

# Rule 2: the seat of each county council, by their CSO names. Cork, Limerick, Galway and Waterford
# have their seats in their cities, and Kilkenny's is the city, so they are in rule 1.
COUNCIL_SEATS = [
    "Carlow", "Cavan", "Ennis", "Lifford", "Naas", "Tralee", "Portlaoise", "Carrick-On-Shannon",
    "Longford", "Dundalk", "Castlebar", "Navan", "Monaghan", "Tullamore", "Roscommon", "Sligo",
    "Clonmel", "Nenagh", "Mullingar", "Wexford", "Wicklow", "Swords",
]

# Dún Laoghaire and Tallaght are council seats inside the Dublin city and suburbs area, so the CSO
# has no town of their own. Where their landmarks are (leinster.md).
SEATS_WITHOUT_A_TOWN = {
    "Dún Laoghaire": ("Dublin", 53.2943212, -6.1347642),
    "Tallaght": ("Dublin", 53.286809, -6.3722758),
}


# Downloaded copies, when given: F1015 first, then the map layer.
SAVED = dict(zip((F1015, BUA), sys.argv[1:3]))


def fetch(url: str) -> dict:
    if url in SAVED:
        return json.loads(Path(SAVED[url]).read_text(encoding="utf-8"))
    request = urllib.request.Request(url, headers={"User-Agent": "landmark-rules-check"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance as the crow flies, in kilometres, between two (latitude, longitude) points."""
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def towns() -> dict[str, dict]:
    """Every town: its population and county from F1015, and where it is from the map layer. By its
    name, with the county added where two towns share one (Fethard in Tipperary and in Wexford)."""
    table = fetch(F1015)
    labels = list(table["dimension"]["C04160V04929"]["category"]["label"].values())
    sexes = len(table["dimension"]["C02199V02655"]["category"]["label"])
    rows = []
    for i, label in enumerate(labels):
        if label == "State":
            continue
        name, _, county = label.partition(", ")
        # A town over a county line is listed under the first county F1015 names ("Counties Carlow &
        # Laois"): the county it is mostly in.
        county = re.sub(r"^(Co|Counties) ", "", county).split(" & ")[0]
        rows.append({"name": name, "county": county, "population": int(table["value"][i * sexes])})
    shared = {row["name"] for row in rows if sum(other["name"] == row["name"] for other in rows) > 1}
    for row in rows:
        if row["name"] in shared:
            row["name"] = f"{row['name']} (Co. {row['county']})"

    # The map layer has no county, so a town is matched by its name and population together. The
    # two spell a few names differently (Rann na Feirste, Rann Na Feirste; Dingle's Irish name), so
    # the case is ignored, and a name that still doesn't match is matched by its population alone
    # when only one town has it.
    by_key = {(re.sub(r" \(Co\. .*\)$", "", row["name"]).casefold(), row["population"]): row for row in rows}
    for feature in fetch(BUA)["features"]:
        name, population = feature["attributes"]["BUA_NAME"], feature["attributes"]["T1_2T"]
        row = by_key.get((name.casefold(), population))
        if row is None:
            same = [row for row in rows if row["population"] == population]
            if len(same) != 1:
                sys.exit(f"The map layer has a town F1015 doesn't: {name} ({population:,})")
            row = same[0]
        row["at"] = (feature["centroid"]["y"], feature["centroid"]["x"])

    missing = [row["name"] for row in rows if "at" not in row]
    if missing:
        sys.exit(f"No position for: {', '.join(missing)}")
    return {row["name"]: row for row in rows}


def pick(all_towns: dict[str, dict]) -> list[dict]:
    """The places the four rules pick, each with the rule that picked it."""
    picked: list[dict] = []
    for name in CITIES:
        picked.append({**all_towns[name], "rule": 1})
    for name in COUNCIL_SEATS:
        picked.append({**all_towns[name], "rule": 2})
    for name, (county, lat, lng) in SEATS_WITHOUT_A_TOWN.items():
        picked.append({"name": name, "county": county, "population": None, "at": (lat, lng), "rule": 2})

    chosen = {place["name"] for place in picked}
    for town in sorted(all_towns.values(), key=lambda town: -town["population"]):
        if town["population"] >= LARGE_TOWN and town["name"] not in chosen:
            picked.append({**town, "rule": 3})
            chosen.add(town["name"])

    # Rule 4: the largest town left that is far from every place picked so far, then again, until
    # there is none. Each pick can cover towns near it, so the order matters: largest first.
    while True:
        far = [
            town
            for town in all_towns.values()
            if town["population"] >= COVERAGE_TOWN
            and town["name"] not in chosen
            and min(km(town["at"], place["at"]) for place in picked) > COVERAGE_KM
        ]
        if not far:
            return picked
        town = max(far, key=lambda town: town["population"])
        picked.append({**town, "rule": 4})
        chosen.add(town["name"])


def listed_now() -> dict[int | None, list[str]]:
    """The places in how-places-were-chosen.md, by population, as the doc names them."""
    doc = (Path(__file__).parent / "how-places-were-chosen.md").read_text(encoding="utf-8")
    # Only the list itself: the To do after it has tables of places too.
    doc = doc[doc.index("## Every place") : doc.index("## To do")]
    rows = re.findall(r"^\| [A-Z][a-z]+ +\| ([^|]+?) +\| [^|]+\| ([0-9,]+|Not counted separately) +\|", doc, re.M)
    by_population: dict[int | None, list[str]] = {}
    for name, population in rows:
        key = int(population.replace(",", "")) if population[0].isdigit() else None
        by_population.setdefault(key, []).append(name)
    return by_population


def main() -> None:
    all_towns = towns()
    picked = pick(all_towns)
    print(f"{len(all_towns)} towns. The rules pick {len(picked)} places:")
    for rule in (1, 2, 3, 4):
        places = [place for place in picked if place["rule"] == rule]
        print(f"  rule {rule}: {len(places)}")

    # Compared with the doc by population: every figure in it is the town's F1015 figure.
    now = listed_now()
    doc_names = {name for names in now.values() for name in names}
    picked_names: set[str] = set()
    added = []
    for place in picked:
        names = now.get(place["population"], []) if place["population"] else [place["name"]]
        match = next((name for name in names if name in doc_names), None)
        if match:
            picked_names.add(match)
        else:
            added.append(place)
    dropped = sorted(doc_names - picked_names)
    by_population = {town["population"]: town for town in all_towns.values()}

    print(f"\nPicked by the rules, not on the list ({len(added)}):")
    for place in sorted(added, key=lambda place: (place["county"], -place["population"])):
        print(f"  {place['county']}: {place['name']} ({place['population']:,}), rule {place['rule']}")
    print(f"\nOn the list, not picked by the rules ({len(dropped)}):")
    for name in dropped:
        population = next(key for key, names in now.items() if name in names)
        town = by_population[population]
        # The place that left it out: the nearest of those picked before it came up, which is every
        # place from rules 1 to 3 and the larger towns from rule 4.
        before = [place for place in picked if place["rule"] < 4 or place["population"] > population]
        nearest = min(before, key=lambda place: km(town["at"], place["at"]))
        print(f"  {town['county']}: {name} ({population:,}), {km(town['at'], nearest['at']):.2f} km from {nearest['name']}")


if __name__ == "__main__":
    main()
