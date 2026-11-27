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
        counties = re.sub(r"^(Co|Counties) ", "", county).split(" & ")
        rows.append({"name": name, "county": counties[0], "counties": counties, "population": int(table["value"][i * sexes])})
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


HERE = Path(__file__).parent

# Where the list names a place differently from the CSO.
CSO_NAMES = {
    "Dublin City": "Dublin city and suburbs",
    "Cork City": "Cork city and suburbs",
    "Limerick City": "Limerick city and suburbs",
    "Galway City": "Galway city and suburbs",
    "Waterford City": "Waterford city and suburbs",
    "Kilkenny City": "Kilkenny",
    "Greystones": "Greystones-Delgany",
    "Donegal Town": "Donegal",
    "Tipperary Town": "Tipperary",
    "Dingle (Daingean Uí Chúis)": "Dingle-Daingean Uí Chúis",
}


def table_rows(text: str) -> list[list[str]]:
    """The body rows of every table in a piece of Markdown, as lists of cells."""
    rows = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r"-+", cell) for cell in cells) or cells[0] in ("County", "City / town"):
            continue
        rows.append(cells)
    return rows


def listed_now() -> list[dict]:
    """The places in how-places-were-chosen.md: county, name, type and population as the doc gives them."""
    doc = (HERE / "how-places-were-chosen.md").read_text(encoding="utf-8")
    # Only the list itself: a To do after it, when there is one, can have tables of places too.
    end = doc.find("## To do")
    doc = doc[doc.index("## Every place") : end if end != -1 else len(doc)]
    places = []
    for county, name, kind, population, *_ in table_rows(doc):
        number = int(population.replace(",", "")) if population[0].isdigit() else None
        places.append({"county": county, "name": name, "type": kind, "population": number})
    return places


def province_files() -> list[dict]:
    """The places in the four province files: county (from the heading above), name and type."""
    places = []
    for path in ("leinster.md", "munster.md", "connacht.md", "ulster-roi.md"):
        county = None
        for line in (HERE / path).read_text(encoding="utf-8").splitlines():
            heading = re.match(r"## Co\. (.+)", line)
            if heading:
                county = heading.group(1).strip()
            elif line.startswith("|"):
                rows = table_rows(line)
                if rows:
                    places.append({"county": county, "name": rows[0][0], "type": rows[0][1], "file": path})
    return places


def cso_town(place: dict, all_towns: dict[str, dict]) -> dict | None:
    """The CSO town a listed place is, by its name and county, or None for a name the CSO doesn't have."""
    name = CSO_NAMES.get(place["name"], place["name"])
    for candidate in (name, f"{name} (Co. {place['county']})"):
        for town in all_towns.values():
            if town["name"].casefold() == candidate.casefold() and place["county"] in town["counties"]:
                return town
    return None


def main() -> None:
    all_towns = towns()
    picked = pick(all_towns)
    print(f"{len(all_towns)} towns. The rules pick {len(picked)} places:")
    for rule in (1, 2, 3, 4):
        places = [place for place in picked if place["rule"] == rule]
        print(f"  rule {rule}: {len(places)}")

    # Each listed place matched to its CSO town by name and county, then its population checked on
    # its own, so a renamed town or a wrong figure shows up rather than passing or stopping the run.
    listed = listed_now()
    problems = []
    listed_ids = set()
    for place in listed:
        if place["name"] in SEATS_WITHOUT_A_TOWN:
            listed_ids.add(place["name"])
            if place["population"] is not None:
                problems.append(f"{place['name']}: the CSO has no figure for it, but the list gives {place['population']:,}")
            continue
        town = cso_town(place, all_towns)
        if town is None:
            problems.append(f"{place['name']} (Co. {place['county']}): no CSO town of that name in that county")
            continue
        listed_ids.add(town["name"])
        if place["population"] != town["population"]:
            given = f"{place['population']:,}" if place["population"] is not None else "none"
            problems.append(f"{place['name']}: the list gives {given}, the CSO {town['population']:,}")

    picked_ids = {place["name"] for place in picked}
    added = [place for place in picked if place["name"] not in listed_ids]
    dropped = [name for name in listed_ids if name not in picked_ids]

    # The province files against the list: the same places, in the same counties, with the same types.
    in_list = {(place["county"], place["name"]): place["type"] for place in listed}
    files = province_files()
    in_files = {(place["county"], place["name"]): place for place in files}
    # A place listed twice would be counted once above, so repeats are reported on their own.
    for where, keys in (("the list", [(place["county"], place["name"]) for place in listed]),
                        ("the province files", [(place["county"], place["name"]) for place in files])):
        for key in sorted({key for key in keys if keys.count(key) > 1}):
            problems.append(f"{key[1]} (Co. {key[0]}): {keys.count(key)} times in {where}")
    for key in sorted(in_list.keys() - in_files.keys()):
        problems.append(f"{key[1]} (Co. {key[0]}): in the list, but in no province file")
    for key in sorted(in_files.keys() - in_list.keys()):
        problems.append(f"{key[1]} (Co. {key[0]}): in {in_files[key]['file']}, but not in the list")
    for key in sorted(in_list.keys() & in_files.keys()):
        if in_list[key] != in_files[key]["type"]:
            problems.append(f"{key[1]}: typed \"{in_list[key]}\" in the list, \"{in_files[key]['type']}\" in {in_files[key]['file']}")

    print(f"\nPicked by the rules, not on the list ({len(added)}):")
    # Dún Laoghaire and Tallaght have no population, as the CSO counts them inside Dublin.
    for place in sorted(added, key=lambda place: (place["county"], -(place["population"] or 0))):
        population = f"{place['population']:,}" if place["population"] is not None else "no CSO figure"
        print(f"  {place['county']}: {place['name']} ({population}), rule {place['rule']}")
    print(f"\nOn the list, not picked by the rules ({len(dropped)}):")
    for name in sorted(dropped):
        town = all_towns[name]
        # The place that left it out: the nearest of those picked before it came up, which is every
        # place from rules 1 to 3 and the larger towns from rule 4.
        before = [place for place in picked if place["rule"] < 4 or place["population"] > town["population"]]
        nearest = min(before, key=lambda place: km(town["at"], place["at"]))
        print(f"  {town['county']}: {name} ({town['population']:,}), {km(town['at'], nearest['at']):.2f} km from {nearest['name']}")
    print(f"\nNames, figures and files that don't agree ({len(problems)}):")
    for problem in problems:
        print(f"  {problem}")


if __name__ == "__main__":
    main()
