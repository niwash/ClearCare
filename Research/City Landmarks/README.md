# City Landmarks

Central landmarks with their coordinates for each of 115 cities and towns across the 26 counties of the Republic of Ireland: a well-known building, square or monument in the town centre, such as the GPO on O'Connell Street in Dublin. Each row cites its source for the coordinates, and says why that landmark was taken as the town's centre.

| File                                                   | What it holds                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [how-places-were-chosen.md](how-places-were-chosen.md) | The rules for choosing the places, the Census 2022 populations and the reason for each place |
| [leinster.md](leinster.md)                             | 55 places in 12 counties                                                                     |
| [munster.md](munster.md)                               | 34 places in 6 counties                                                                      |
| [connacht.md](connacht.md)                             | 16 places in 5 counties                                                                      |
| [ulster-roi.md](ulster-roi.md)                         | 10 places in Cavan, Donegal and Monaghan                                                     |
| [check_rules.py](check_rules.py)                       | Applies the rules to every town in the CSO's list, and shows how the list differs            |

## How the list was made

- **Who filled it in:** the team split the counties between five members, and each filled in a landmark, its coordinates and a source for their places. A reviewer then checked every point against its cited source (the OpenStreetMap feature, or the grid reference in the National Inventory of Architectural Heritage, buildingsofireland.ie) and against council plans and local sources for whether it is the town's centre.
- **Coordinates:** decimal degrees (WGS84). Where a landmark isn't in OpenStreetMap, the coordinates were converted from its Irish Grid reference in the National Inventory of Architectural Heritage.
- **How it was filled in:** the team worked on a shared Excel spreadsheet.
