# How the cities and towns were chosen

The landmark list covers **93 places in all 26 counties**: 40 in Leinster, 23 in Munster, 15 in Connacht and 15 in the three Ulster counties in the Republic. It isn't the top 3 biggest cities, or a fixed number per county. The same four rules apply to every county:

1. **Cities.** All six of Ireland's cities: Dublin, Cork, Limerick, Galway and Waterford, which are cities under the Local Government Act 2001, and Kilkenny, which keeps the title by historic charter. They are in because of their city status, not their population.
2. **County towns.** The seat of each county council, whatever its size: Lifford, Donegal's county town, has 1,613 people. Tipperary has two seats, Clonmel and Nenagh, and both are in. In Dublin, the seats of the three councils other than Dublin City (Dún Laoghaire, Swords and Tallaght) are in for the same reason, and are listed as council seats.
3. **Large towns.** Every other town with **5,000 people or more** in Census 2022 (the CSO's table F1015).
4. **Coverage.** A town with **1,500 people or more** that is **more than 20 km**, as the crow flies, from every place already chosen, so that no part of the country is far from a place on the map. The distance is measured to places in any county, not only the town's own. The largest such town is taken first, then the largest left, until no town of 1,500 or more is more than 20 km from a chosen place. For example, Kilrush (2,649) is in, as the nearest chosen place is Listowel, 21.2 km away across the Shannon estuary, while Sixmilebridge (2,832) is out, as it is 7.9 km from Shannon.

So the number of places per county follows the county's size and spread rather than a quota. Anyone can apply the rules and get the same list, though the list below doesn't follow rules 3 and 4 yet: see [To do](#to-do).

### Checking the rules

[check_rules.py](check_rules.py) applies the four rules to all 867 towns in the CSO's list and prints the places they choose, and how that differs from the list below. Run it with `python check_rules.py` (Python 3.9 or later, nothing to install). A town's position is the middle of its area on the CSO's Census 2022 map of towns, and distances are measured between those. Dún Laoghaire and Tallaght have no area of their own, as they are inside Dublin, so their landmarks stand in.

## Where the population figures come from

- **Census 2022, CSO:** table [F1015, Population and Average Age by Sex and List of Towns](https://data.cso.ie/table/F1015), Census of Population 2022, Profile 1: Population Distribution and Movements. The population is for both sexes, from the table as updated on 29 June 2023, read through the [CSO's open data API](https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/F1015/JSON-stat/2.0/en) on 26 November 2026. CSO data is published under a Creative Commons Attribution 4.0 (CC BY 4.0) licence.
- **What a figure covers:** each is for a town as the CSO defines it for the census (a Built Up Area), which includes its suburbs and environs. The Dublin, Cork, Limerick, Galway and Waterford figures are for the whole "city and suburbs" area, and the Dublin figure takes in the parts of the area in Co. Meath. The CSO names Greystones as Greystones-Delgany.
- **Not counted separately:** Dún Laoghaire and Tallaght are inside the Dublin city and suburbs area, so the CSO gives them no figure of their own.
- **Where each town is:** the CSO's Census 2022 map of towns ([Built Up Areas](https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/arcgis/rest/services/CensusHub2022_T1_2_BUA/FeatureServer/0)), the same 867 towns with the same populations as F1015. Used only by `check_rules.py`, to measure rule 4's distances.
- **City status:** [Local Government Act 2001](https://www.irishstatutebook.ie/eli/2001/act/37/enacted/en/html).
- **County towns and council seats:** each county council's own website (e.g. donegalcoco.ie, tipperarycoco.ie).

All 91 figures were checked against the CSO table.

## Every place and why it was chosen

### Leinster

| County    | City / town                              | Type               | Population (Census 2022) | Why it was chosen                                                                                                                                             |
| --------- | ---------------------------------------- | ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carlow    | Carlow                                   | County town        | 27,351                   | County town of Co. Carlow; largest town in the county.                                                                                                        |
| Carlow    | Tullow                                   | Large town         | 5,138                    | Second town of Co. Carlow; covers the east of the county.                                                                                                     |
| Dublin    | Dublin City                              | Capital city       | 1,263,219                | Capital of Ireland and largest city (figure is 'Dublin city and suburbs').                                                                                    |
| Dublin    | Dún Laoghaire                            | Council seat       | Not counted separately   | Seat of Dún Laoghaire–Rathdown County Council; main centre of south-east Co. Dublin. Not counted separately by CSO (inside the Dublin city and suburbs area). |
| Dublin    | Swords                                   | Council seat       | 40,776                   | Seat of Fingal County Council; largest of the north Co. Dublin towns listed.                                                                                  |
| Dublin    | Malahide                                 | Large town         | 18,608                   | Large coastal town in north Co. Dublin; added for northside coverage.                                                                                         |
| Dublin    | Tallaght                                 | Council seat       | Not counted separately   | Seat of South Dublin County Council; main centre of south-west Co. Dublin. Not counted separately by CSO (inside the Dublin city and suburbs area).           |
| Dublin    | Balbriggan                               | Large town         | 24,322                   | Large town in the far north of Co. Dublin.                                                                                                                    |
| Kildare   | Naas                                     | County town        | 26,180                   | County town of Co. Kildare (seat of Kildare County Council).                                                                                                  |
| Kildare   | Newbridge                                | Large town         | 24,366                   | Large town in Co. Kildare.                                                                                                                                    |
| Kildare   | Celbridge                                | Large town         | 20,601                   | Large town in north Co. Kildare (Dublin commuter belt).                                                                                                       |
| Kildare   | Maynooth                                 | Large town         | 17,259                   | University town (Maynooth University); large town in north Co. Kildare.                                                                                       |
| Kildare   | Leixlip                                  | Large town         | 16,733                   | Large town in north Co. Kildare.                                                                                                                              |
| Kildare   | Athy                                     | Large town         | 11,035                   | Largest town in south Co. Kildare.                                                                                                                            |
| Kilkenny  | Kilkenny City                            | City & county town | 27,184                   | County town of Co. Kilkenny; one of Ireland's six cities, by historic charter.                                                                                |
| Kilkenny  | Callan                                   | Large town         | 2,678                    | Second-largest town in Co. Kilkenny; covers west Kilkenny.                                                                                                    |
| Laois     | Portlaoise                               | County town        | 23,494                   | County town of Co. Laois; largest town in the county.                                                                                                         |
| Laois     | Portarlington                            | Large town         | 9,288                    | Second town of Co. Laois; covers the north of the county.                                                                                                     |
| Longford  | Longford                                 | County town        | 10,952                   | County town of Co. Longford; largest town in the county.                                                                                                      |
| Longford  | Edgeworthstown                           | Large town         | 2,199                    | Second-largest town in Co. Longford; covers east Longford.                                                                                                    |
| Louth     | Dundalk                                  | County town        | 43,112                   | County town of Co. Louth.                                                                                                                                     |
| Louth     | Drogheda                                 | Large town         | 44,135                   | Largest town in Co. Louth (and in Ireland).                                                                                                                   |
| Meath     | Navan                                    | County town        | 33,886                   | County town of Co. Meath; largest town in the county.                                                                                                         |
| Meath     | Ashbourne                                | Large town         | 15,680                   | Second-largest listed town in Co. Meath; covers the south-east of the county.                                                                                 |
| Meath     | Laytown-Bettystown-Mornington-Donacarney | Large town         | 15,642                   | Third-largest town in Co. Meath; covers the east coast, which no other pick does.                                                                             |
| Meath     | Ratoath                                  | Large town         | 10,077                   | Large town in south-east Co. Meath; larger than Trim by Census 2022.                                                                                          |
| Meath     | Trim                                     | Large town         | 9,563                    | Heritage town; kept under rule 4 as the main town of central Co. Meath.                                                                                       |
| Offaly    | Tullamore                                | County town        | 15,598                   | County town of Co. Offaly; largest town in the county.                                                                                                        |
| Offaly    | Birr                                     | Large town         | 4,726                    | Heritage town; covers the south of Co. Offaly.                                                                                                                |
| Offaly    | Edenderry                                | Large town         | 7,888                    | Covers the north-east of Co. Offaly.                                                                                                                          |
| Westmeath | Mullingar                                | County town        | 22,667                   | County town of Co. Westmeath.                                                                                                                                 |
| Westmeath | Athlone                                  | Large town         | 22,869                   | Largest town in Co. Westmeath; regional centre on the Shannon.                                                                                                |
| Wexford   | Wexford                                  | County town        | 21,524                   | County town of Co. Wexford; largest town in the county.                                                                                                       |
| Wexford   | Enniscorthy                              | Large town         | 12,310                   | Large town in central Co. Wexford.                                                                                                                            |
| Wexford   | Gorey                                    | Large town         | 11,517                   | Large town in north Co. Wexford.                                                                                                                              |
| Wexford   | New Ross                                 | Large town         | 8,610                    | Covers the west of Co. Wexford.                                                                                                                               |
| Wicklow   | Wicklow                                  | County town        | 12,957                   | County town of Co. Wicklow.                                                                                                                                   |
| Wicklow   | Bray                                     | Large town         | 33,512                   | Largest town in Co. Wicklow.                                                                                                                                  |
| Wicklow   | Greystones                               | Large town         | 22,009                   | Large town in north Co. Wicklow.                                                                                                                              |
| Wicklow   | Arklow                                   | Large town         | 13,399                   | Large town in south Co. Wicklow.                                                                                                                              |

### Munster

| County    | City / town     | Type               | Population (Census 2022) | Why it was chosen                                                                                                                              |
| --------- | --------------- | ------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Clare     | Ennis           | County town        | 27,923                   | County town of Co. Clare; largest town in the county.                                                                                          |
| Clare     | Shannon         | Large town         | 10,256                   | Second town of Co. Clare (Shannon Airport).                                                                                                    |
| Clare     | Kilrush         | Large town         | 2,649                    | Kept under rule 4 as the main town of west Clare; Sixmilebridge (2,832) is larger but sits ~8 km from Shannon, which already covers that area. |
| Cork      | Cork City       | City & county town | 222,526                  | County town of Co. Cork; Ireland's second city (figure is 'Cork city and suburbs').                                                            |
| Cork      | Carrigaline     | Large town         | 18,239                   | Large town on Cork Harbour, south of the city.                                                                                                 |
| Cork      | Cobh            | Large town         | 14,148                   | Large town in Cork Harbour.                                                                                                                    |
| Cork      | Midleton        | Large town         | 13,906                   | Large town in east Co. Cork.                                                                                                                   |
| Cork      | Mallow          | Large town         | 13,456                   | Main town of north Co. Cork.                                                                                                                   |
| Cork      | Youghal         | Large town         | 8,564                    | Covers the far east of Co. Cork.                                                                                                               |
| Kerry     | Tralee          | County town        | 26,079                   | County town of Co. Kerry; largest town in the county.                                                                                          |
| Kerry     | Killarney       | Large town         | 14,412                   | Second town of Co. Kerry; major tourist centre.                                                                                                |
| Kerry     | Listowel        | Large town         | 4,794                    | Covers north Co. Kerry.                                                                                                                        |
| Limerick  | Limerick City   | City & county town | 102,287                  | County town of Co. Limerick; one of Ireland's cities (figure is 'Limerick city and suburbs').                                                  |
| Limerick  | Newcastle West  | Large town         | 7,209                    | Covers west Co. Limerick.                                                                                                                      |
| Tipperary | Clonmel         | County town        | 18,369                   | County town of Co. Tipperary; largest town in the county.                                                                                      |
| Tipperary | Nenagh          | County town        | 9,895                    | Other seat of Tipperary County Council; covers north Tipperary.                                                                                |
| Tipperary | Thurles         | Large town         | 8,185                    | Large town in mid Tipperary.                                                                                                                   |
| Tipperary | Carrick-on-Suir | Large town         | 5,752                    | Covers south-east Tipperary.                                                                                                                   |
| Tipperary | Roscrea         | Large town         | 5,542                    | Large town covering north-east Tipperary, about 30 km from Nenagh and Thurles.                                                                 |
| Tipperary | Tipperary Town  | Large town         | 5,387                    | Covers west Tipperary; the county's namesake town.                                                                                             |
| Waterford | Waterford City  | City & county town | 60,079                   | County town of Co. Waterford; one of Ireland's cities (figure is 'Waterford city and suburbs').                                                |
| Waterford | Dungarvan       | Large town         | 10,081                   | Main town of west Co. Waterford; seat of the council's west Waterford offices.                                                                 |
| Waterford | Tramore         | Large town         | 11,277                   | Large coastal town in Co. Waterford.                                                                                                           |

### Connacht

| County    | City / town        | Type               | Population (Census 2022) | Why it was chosen                                                                                         |
| --------- | ------------------ | ------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Galway    | Galway City        | City & county town | 85,910                   | County town of Co. Galway; one of Ireland's cities (figure is 'Galway city and suburbs').                 |
| Galway    | Tuam               | Large town         | 9,647                    | Largest town in north Co. Galway.                                                                         |
| Galway    | Ballinasloe        | Large town         | 6,597                    | Covers east Co. Galway.                                                                                   |
| Galway    | Loughrea           | Large town         | 6,322                    | Covers south-east Co. Galway.                                                                             |
| Leitrim   | Carrick-on-Shannon | County town        | 4,743                    | County town of Co. Leitrim; largest town in the county.                                                   |
| Leitrim   | Manorhamilton      | Large town         | 1,667                    | Covers north Co. Leitrim. |
| Mayo      | Castlebar          | County town        | 13,054                   | County town of Co. Mayo; largest town in the county.                                                      |
| Mayo      | Ballina            | Large town         | 10,556                   | Second town of Co. Mayo; covers north Mayo.                                                               |
| Mayo      | Westport           | Large town         | 6,872                    | Covers west Mayo; major tourist town.                                                                     |
| Roscommon | Roscommon          | County town        | 6,555                    | County town of Co. Roscommon.                                                                             |
| Roscommon | Boyle              | Large town         | 2,915                    | Covers north Co. Roscommon.                                                                               |
| Roscommon | Ballaghaderreen    | Large town         | 2,387                    | Covers north-west Co. Roscommon by the Mayo border; slightly larger than Castlerea.                       |
| Roscommon | Castlerea          | Large town         | 2,348                    | Covers west Co. Roscommon.                                                                                |
| Sligo     | Sligo              | County town        | 20,608                   | County town of Co. Sligo; largest town in the county.                                                     |
| Sligo     | Tubbercurry        | Large town         | 2,307                    | Covers south Co. Sligo.                                                                                   |

### Ulster (ROI)

| County   | City / town           | Type        | Population (Census 2022) | Why it was chosen                                                                                                                                                     |
| -------- | --------------------- | ----------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cavan    | Cavan                 | County town | 11,741                   | County town of Co. Cavan; largest town in the county.                                                                                                                 |
| Cavan    | Virginia              | Large town  | 3,211                    | Second-largest town in Co. Cavan; covers south Cavan.                                                                                                                 |
| Cavan    | Bailieborough         | Large town  | 2,974                    | Covers east Co. Cavan.                                                                                                                                                |
| Cavan    | Cootehill             | Large town  | 1,856                    | Covers north-east Co. Cavan.                                                                                                                                          |
| Donegal  | Lifford               | County town | 1,613                    | Official county town of Co. Donegal (seat of Donegal County Council), although small. |
| Donegal  | Letterkenny           | Large town  | 22,549                   | Largest town in Co. Donegal.                                                                                                                                          |
| Donegal  | Buncrana              | Large town  | 6,971                    | Main town of the Inishowen peninsula.                                                                                                                                 |
| Donegal  | Ballybofey-Stranorlar | Large town  | 5,406                    | Third-largest town in Co. Donegal; covers the Finn Valley in the centre of the county.                                                                                |
| Donegal  | Carndonagh            | Large town  | 2,768                    | Covers north Inishowen, about 25 km from Buncrana.                                                                                                                    |
| Donegal  | Donegal Town          | Large town  | 2,749                    | Covers south Co. Donegal; the county's namesake town.                                                                                                                 |
| Donegal  | Bundoran              | Large town  | 2,599                    | Covers the far south of Co. Donegal; larger than Ballyshannon, 6 km away.                                                                                             |
| Monaghan | Monaghan              | County town | 7,894                    | County town of Co. Monaghan; largest town in the county.                                                                                                              |
| Monaghan | Carrickmacross        | Large town  | 5,745                    | Covers south Co. Monaghan.                                                                                                                                            |
| Monaghan | Castleblayney         | Large town  | 3,926                    | Covers south-east Co. Monaghan.                                                                                                                                       |
| Monaghan | Clones                | Large town  | 1,885                    | Covers west Co. Monaghan.                                                                                                                                             |

## To do

`check_rules.py` gives the list that rules 3 and 4 now ask for. It has 115 places: the 93 below, less 12, and 34 more. A follow-up change will bring the list in line with it.

### Places the rules add (34)

Each needs a landmark, with its coordinates and a source, as the other places have.

| County  | City / town                | Population (Census 2022) | Rule |
| ------- | -------------------------- | ------------------------ | ---- |
| Cork    | Bandon                     | 8,196                    | 3    |
| Cork    | Fermoy                     | 6,720                    | 3    |
| Cork    | Passage West-Monkstown     | 6,051                    | 3    |
| Cork    | Kinsale                    | 5,991                    | 3    |
| Cork    | Carrigtwohill              | 5,568                    | 3    |
| Cork    | Clonakilty                 | 5,112                    | 3    |
| Cork    | Macroom                    | 4,096                    | 4    |
| Cork    | Charleville                | 3,970                    | 4    |
| Cork    | Bantry                     | 2,929                    | 4    |
| Dublin  | Rush                       | 10,875                   | 3    |
| Dublin  | Portmarnock                | 10,750                   | 3    |
| Dublin  | Skerries                   | 10,743                   | 3    |
| Dublin  | Donabate                   | 9,669                    | 3    |
| Dublin  | Lusk                       | 8,806                    | 3    |
| Dublin  | Kinsealy-Drinan            | 7,526                    | 3    |
| Dublin  | Rathcoole                  | 5,792                    | 3    |
| Galway  | Oranmore                   | 5,819                    | 3    |
| Galway  | Gort                       | 2,870                    | 4    |
| Galway  | Oughterard                 | 1,846                    | 4    |
| Kerry   | Kenmare                    | 2,566                    | 4    |
| Kerry   | Dingle (Daingean Uí Chúis) | 1,671                    | 4    |
| Kildare | Kildare                    | 10,302                   | 3    |
| Kildare | Kilcock                    | 8,674                    | 3    |
| Kildare | Clane                      | 8,152                    | 3    |
| Kildare | Sallins                    | 6,269                    | 3    |
| Kildare | Monasterevin               | 5,307                    | 3    |
| Louth   | Ardee                      | 5,478                    | 3    |
| Mayo    | Claremorris                | 3,857                    | 4    |
| Meath   | Dunboyne                   | 7,155                    | 3    |
| Meath   | Dunshaughlin               | 6,644                    | 3    |
| Meath   | Kells                      | 6,608                    | 3    |
| Offaly  | Banagher                   | 1,907                    | 4    |
| Sligo   | Ballymote                  | 1,711                    | 4    |
| Wicklow | Blessington                | 5,611                    | 3    |

Kilcock and Blessington cross a county line; each is under the county the CSO names first. The CSO calls Dingle "Dingle-Daingean Uí Chúis".

### Places the rules take off (12)

Each has fewer than 5,000 people and is within 20 km of a place chosen before it, so neither rule 3 nor rule 4 picks it.

| County    | City / town    | Population (Census 2022) | Within 20 km of             |
| --------- | -------------- | ------------------------ | --------------------------- |
| Cavan     | Bailieborough  | 2,974                    | Carrickmacross, 18.0 km     |
| Cavan     | Virginia       | 3,211                    | Kells, 18.0 km              |
| Donegal   | Carndonagh     | 2,768                    | Buncrana, 17.4 km           |
| Kilkenny  | Callan         | 2,678                    | Kilkenny, 15.4 km           |
| Leitrim   | Manorhamilton  | 1,667                    | Sligo, 19.96 km             |
| Longford  | Edgeworthstown | 2,199                    | Longford, 12.6 km           |
| Monaghan  | Castleblayney  | 3,926                    | Carrickmacross, 15.7 km     |
| Monaghan  | Clones         | 1,885                    | Monaghan, 18.7 km           |
| Offaly    | Birr           | 4,726                    | Roscrea, 17.7 km            |
| Roscommon | Boyle          | 2,915                    | Carrick-on-Shannon, 13.9 km |
| Roscommon | Castlerea      | 2,348                    | Ballaghaderreen, 16.1 km    |
| Sligo     | Tubbercurry    | 2,307                    | Ballaghaderreen, 19.5 km    |

Manorhamilton is only just inside the 20 km: a slightly shorter radius would keep it.
