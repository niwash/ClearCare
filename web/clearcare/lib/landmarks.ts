// lib/landmarks.ts
// The landmark a search from a town measures from (CCARE-322). Google has several suggestions for
// one town, at different points: "Dublin City, County Dublin" is in the Phoenix Park, 3.8 km from
// "Dublin" on O'Connell Street. So a search from one of the towns in Research/City Landmarks
// measures from the landmark the research took as the town's centre, whichever suggestion it was.
// The tests load this file as it is, so its import is named with its extension.
import { nearFrom } from "./near.ts";

export interface Landmark {
  place: string; // the city or town, as the research names it: "Dublin City"
  county: string;
  landmark: string; // "General Post Office (GPO), O'Connell Street"
  latitude: number;
  longitude: number;
  otherNames?: string[]; // what else Google calls the town, or the part of it the landmark is in
}

// The rows of the research's four province files, in their order. tests/landmarks.test.ts fails when
// the two differ. The other names are not the research's: they are the names Google gave for these
// towns on 27 November 2026. Laytown, Mornington, Donacarney, Monkstown, Kinsealy and Stranorlar are
// not among them: Google has each as a place of its own, away from the landmark.
export const LANDMARKS: Landmark[] = [
  // Leinster (leinster.md)
  { place: "Carlow", county: "Carlow", landmark: "The Liberty Tree (Potato Market)", latitude: 52.8352403, longitude: -6.9295052 },
  { place: "Tullow", county: "Carlow", landmark: "Father John Murphy Memorial (Market Square)", latitude: 52.8031081, longitude: -6.7359484 },
  { place: "Dublin City", county: "Dublin", landmark: "General Post Office (GPO), O'Connell Street", latitude: 53.3492845, longitude: -6.2610506 },
  { place: "Dún Laoghaire", county: "Dublin", landmark: "Dún Laoghaire-Rathdown County Hall (Marine Road)", latitude: 53.2943212, longitude: -6.1347642 },
  { place: "Swords", county: "Dublin", landmark: "Swords Castle (top of Main Street)", latitude: 53.4598651, longitude: -6.2200121 },
  { place: "Malahide", county: "Dublin", landmark: "New Street (village centre)", latitude: 53.4513113, longitude: -6.1537646 },
  { place: "Tallaght", county: "Dublin", landmark: "The Square Towncentre", latitude: 53.286809, longitude: -6.3722758 },
  { place: "Balbriggan", county: "Dublin", landmark: "Carnegie Library clock tower (George's Square)", latitude: 53.6084749, longitude: -6.1821288 },
  { place: "Rush", county: "Dublin", landmark: "Saint Maur's Catholic Church, Chapel Green", latitude: 53.5223286, longitude: -6.1006176 },
  { place: "Portmarnock", county: "Dublin", landmark: "Saint Anne's Church (Strand Road)", latitude: 53.4213345, longitude: -6.135604 },
  { place: "Skerries", county: "Dublin", landmark: "Hamilton Monument, Strand Street", latitude: 53.580685, longitude: -6.107017 },
  { place: "Donabate", county: "Dublin", landmark: "Saint Patrick's Church, The Square", latitude: 53.485566, longitude: -6.154381 },
  { place: "Lusk", county: "Dublin", landmark: "Saint MacCullin's Church and Round Tower, Church Road", latitude: 53.526075, longitude: -6.167083 },
  { place: "Kinsealy-Drinan", county: "Dublin", landmark: "Church of Our Lady of the Visitation (Drinan)", latitude: 53.4466871, longitude: -6.1987963, otherNames: ["Drinan"] },
  { place: "Rathcoole", county: "Dublin", landmark: "Rathcoole Library (former courthouse), Main Street", latitude: 53.281102, longitude: -6.470765 },
  { place: "Naas", county: "Kildare", landmark: "Poplar Square", latitude: 53.2195195, longitude: -6.6613863 },
  { place: "Newbridge", county: "Kildare", landmark: "Whitewater Shopping Centre (Main Street)", latitude: 53.178015, longitude: -6.7980683 },
  { place: "Celbridge", county: "Kildare", landmark: "Arthur Guinness statue (Main Street)", latitude: 53.3404797, longitude: -6.5378127 },
  { place: "Maynooth", county: "Kildare", landmark: "Maynooth Castle (Main Street / university entrance)", latitude: 53.3812607, longitude: -6.5938884 },
  { place: "Leixlip", county: "Kildare", landmark: "Main Street (village centre)", latitude: 53.3638138, longitude: -6.4899426 },
  { place: "Athy", county: "Kildare", landmark: "Emily Square", latitude: 52.9920356, longitude: -6.9834026 },
  { place: "Kildare", county: "Kildare", landmark: "Kildare Market House, Market Square", latitude: 53.156978, longitude: -6.910476 },
  { place: "Kilcock", county: "Kildare", landmark: "The Square (Market Square)", latitude: 53.4003816, longitude: -6.6672176 },
  { place: "Clane", county: "Kildare", landmark: "Church of Saint Patrick and Saint Brigid, Main Street", latitude: 53.292026, longitude: -6.685807 },
  { place: "Sallins", county: "Kildare", landmark: "Church of Our Lady and the Guardian Angels, Church Avenue", latitude: 53.248489, longitude: -6.664027 },
  { place: "Monasterevin", county: "Kildare", landmark: "Monasterevin Market House, Main Street / Market Square", latitude: 53.138519, longitude: -7.063048 },
  { place: "Kilkenny City", county: "Kilkenny", landmark: "The Tholsel", latitude: 52.6519241, longitude: -7.2529385 },
  { place: "Portlaoise", county: "Laois", landmark: "Portlaoise Courthouse", latitude: 53.0342208, longitude: -7.2998439 },
  { place: "Portarlington", county: "Laois", landmark: "Portarlington Market House", latitude: 53.1618256, longitude: -7.1895251 },
  { place: "Longford", county: "Longford", landmark: "Market Square", latitude: 53.7256541, longitude: -7.7998299 },
  { place: "Dundalk", county: "Louth", landmark: "Dundalk Courthouse", latitude: 54.0045871, longitude: -6.4013411 },
  { place: "Drogheda", county: "Louth", landmark: "The Tholsel", latitude: 53.7147779, longitude: -6.3504627 },
  { place: "Ardee", county: "Louth", landmark: "Ardee Castle, Castle Street", latitude: 53.85513, longitude: -6.538738 },
  { place: "Navan", county: "Meath", landmark: "Market Square", latitude: 53.6531035, longitude: -6.6841805 },
  { place: "Ashbourne", county: "Meath", landmark: "Catholic Church of the Immaculate Conception", latitude: 53.5120095, longitude: -6.3988877 },
  { place: "Laytown-Bettystown-Mornington-Donacarney", county: "Meath", landmark: "Bettystown village centre (R150)", latitude: 53.6982898, longitude: -6.2444156, otherNames: ["Bettystown"] },
  { place: "Ratoath", county: "Meath", landmark: "Church of the Holy Trinity (Main Street)", latitude: 53.507375, longitude: -6.4612223 },
  { place: "Trim", county: "Meath", landmark: "Trim Town Hall", latitude: 53.5547138, longitude: -6.7906506 },
  { place: "Dunboyne", county: "Meath", landmark: "Church of Saint Peter and Saint Paul, Main Street", latitude: 53.41992, longitude: -6.47311 },
  { place: "Dunshaughlin", county: "Meath", landmark: "Dunshaughlin Courthouse, Main Street", latitude: 53.510927, longitude: -6.538994 },
  { place: "Kells", county: "Meath", landmark: "Kells Round Tower (Saint Columba's churchyard)", latitude: 53.7273028, longitude: -6.8800866 },
  { place: "Tullamore", county: "Offaly", landmark: "O'Connor Square", latitude: 53.2742544, longitude: -7.4925575 },
  { place: "Edenderry", county: "Offaly", landmark: "Edenderry Town Hall", latitude: 53.3433258, longitude: -7.0489609 },
  { place: "Banagher", county: "Offaly", landmark: "Market Square (Main Street / Church Road)", latitude: 53.1889594, longitude: -7.9858047 },
  { place: "Mullingar", county: "Westmeath", landmark: "Market House, Market Square (Pearse Street)", latitude: 53.5255023, longitude: -7.3414071 },
  { place: "Athlone", county: "Westmeath", landmark: "Athlone Civic Centre (Church Street)", latitude: 53.4242129, longitude: -7.9373537 },
  { place: "Wexford", county: "Wexford", landmark: "1798 Monument", latitude: 52.3398071, longitude: -6.462387 },
  { place: "Enniscorthy", county: "Wexford", landmark: "1798 Memorial, Market Square", latitude: 52.5017956, longitude: -6.5688748 },
  { place: "Gorey", county: "Wexford", landmark: "Gorey Market House", latitude: 52.6756088, longitude: -6.2942038 },
  { place: "New Ross", county: "Wexford", landmark: "New Ross Town Hall", latitude: 52.3955418, longitude: -6.9443853 },
  { place: "Wicklow", county: "Wicklow", landmark: "Billy Byrne Monument (Market Square)", latitude: 52.9796648, longitude: -6.0377027 },
  { place: "Bray", county: "Wicklow", landmark: "Bray Town Hall (Main Street / Vevay Road)", latitude: 53.2005273, longitude: -6.1111804 },
  { place: "Greystones", county: "Wicklow", landmark: "Greystones Station (Church Road)", latitude: 53.1440597, longitude: -6.0609923 },
  { place: "Arklow", county: "Wicklow", landmark: "Ronnie Delany Statue (Main Street)", latitude: 52.7992262, longitude: -6.14983 },
  { place: "Blessington", county: "Wicklow", landmark: "Downshire Monument, Main Street (market square)", latitude: 53.1711, longitude: -6.532424 },
  // Munster (munster.md)
  { place: "Ennis", county: "Clare", landmark: "Daniel O'Connell Monument (O'Connell Monument), O'Connell Square", latitude: 52.8443772, longitude: -8.9825397 },
  { place: "Shannon", county: "Clare", landmark: "SkyCourt Shopping Centre (town centre)", latitude: 52.7107446, longitude: -8.8791397 },
  { place: "Kilrush", county: "Clare", landmark: "Kilrush Market House (Town Hall / Heritage Centre), Market Square", latitude: 52.6379978, longitude: -9.4843097 },
  { place: "Cork City", county: "Cork", landmark: "Father Mathew Statue (St Patrick's Street)", latitude: 51.9000147, longitude: -8.4705828 },
  { place: "Carrigaline", county: "Cork", landmark: "Church of Our Lady & St John (Main Street)", latitude: 51.8160876, longitude: -8.3908194 },
  { place: "Cobh", county: "Cork", landmark: "Lusitania Peace Memorial (Casement Square)", latitude: 51.850365, longitude: -8.2951124 },
  { place: "Midleton", county: "Cork", landmark: "Market House / Midleton Library (Main Street)", latitude: 51.9140437, longitude: -8.1727343 },
  { place: "Mallow", county: "Cork", landmark: "Clock House (Spa Square)", latitude: 52.1351768, longitude: -8.6408177 },
  { place: "Youghal", county: "Cork", landmark: "Clock Gate Tower", latitude: 51.952721, longitude: -7.8467929 },
  { place: "Bandon", county: "Cork", landmark: "Bandon Town Hall, North Main Street", latitude: 51.746836, longitude: -8.738342 },
  { place: "Fermoy", county: "Cork", landmark: "Market House, Pearse Square", latitude: 52.13768, longitude: -8.275252 },
  { place: "Passage West-Monkstown", county: "Cork", landmark: "Passage West Town Hall (Maritime Museum)", latitude: 51.8723603, longitude: -8.3364562, otherNames: ["Passage West"] },
  { place: "Kinsale", county: "Cork", landmark: "Kinsale Museum (Market House), Market Square", latitude: 51.706282, longitude: -8.524328 },
  { place: "Carrigtwohill", county: "Cork", landmark: "Saint Mary's Catholic Church, Church Lane", latitude: 51.910343, longitude: -8.260666 },
  { place: "Clonakilty", county: "Cork", landmark: "1798 Monument (the Pikeman), Asna Square", latitude: 51.62297, longitude: -8.887846 },
  { place: "Macroom", county: "Cork", landmark: "Macroom Market House, The Square", latitude: 51.904724, longitude: -8.95972 },
  { place: "Charleville", county: "Cork", landmark: "Charleville Market House, Main Street", latitude: 52.354794, longitude: -8.682898 },
  { place: "Bantry", county: "Cork", landmark: "Statue of Wolfe Tone, Wolfe Tone Square", latitude: 51.6803543, longitude: -9.4529636 },
  { place: "Tralee", county: "Kerry", landmark: "The Square", latitude: 52.2691121, longitude: -9.7064743 },
  { place: "Killarney", county: "Kerry", landmark: "Killarney Town Hall", latitude: 52.0578584, longitude: -9.5088836 },
  { place: "Listowel", county: "Kerry", landmark: "The Square", latitude: 52.4448854, longitude: -9.4863732 },
  { place: "Kenmare", county: "Kerry", landmark: "Kenmare Market House, The Square", latitude: 51.880357, longitude: -9.58441 },
  { place: "Dingle (Daingean Uí Chúis)", county: "Kerry", landmark: "Saint Mary's Catholic Church, Green Street", latitude: 52.141613, longitude: -10.270997, otherNames: ["Dingle", "Daingean Uí Chúis"] },
  { place: "Limerick City", county: "Limerick", landmark: "O'Connell Monument (The Crescent)", latitude: 52.6589231, longitude: -8.6317822 },
  { place: "Newcastle West", county: "Limerick", landmark: "The Square (in front of Desmond Castle)", latitude: 52.4510712, longitude: -9.0605176 },
  { place: "Clonmel", county: "Tipperary", landmark: "Main Guard (O'Connell St)", latitude: 52.3529774, longitude: -7.7013943 },
  { place: "Nenagh", county: "Tipperary", landmark: "Banba Square (memorial monument)", latitude: 52.8646527, longitude: -8.1997553 },
  { place: "Thurles", county: "Tipperary", landmark: "Liberty Square", latitude: 52.6791504, longitude: -7.8129725 },
  { place: "Carrick-on-Suir", county: "Tipperary", landmark: "Town Clock / The Tholsel, West Gate (Sean Kelly Square)", latitude: 52.3467258, longitude: -7.4145742 },
  { place: "Roscrea", county: "Tipperary", landmark: "Roscrea Castle (Castle Street)", latitude: 52.954951, longitude: -7.7980466 },
  { place: "Tipperary Town", county: "Tipperary", landmark: "Charles Kickham Monument (Kickham Street / Main Street)", latitude: 52.4737752, longitude: -8.1602522 },
  { place: "Waterford City", county: "Waterford", landmark: "John Roberts Square", latitude: 52.2609488, longitude: -7.1118538 },
  { place: "Dungarvan", county: "Waterford", landmark: "Grattan Square", latitude: 52.0892564, longitude: -7.6208577 },
  { place: "Tramore", county: "Waterford", landmark: "Tramore Library (The Square)", latitude: 52.1609885, longitude: -7.1525891 },
  // Connacht (connacht.md)
  { place: "Galway City", county: "Galway", landmark: "Browne Doorway, Eyre Square (north end of the square)", latitude: 53.2747458, longitude: -9.0496852 },
  { place: "Tuam", county: "Galway", landmark: "Tuam Town Hall, Market Square", latitude: 53.5146851, longitude: -8.8514006 },
  { place: "Ballinasloe", county: "Galway", landmark: "St Michael's Church, St Michael's Square", latitude: 53.3286854, longitude: -8.2201626 },
  { place: "Loughrea", county: "Galway", landmark: "Loughrea Town Hall, Barrack Street / Church Street", latitude: 53.1975314, longitude: -8.5677658 },
  { place: "Oranmore", county: "Galway", landmark: "Joseph Howley Monument, Main Street / Dublin Road", latitude: 53.268672, longitude: -8.928977 },
  { place: "Gort", county: "Galway", landmark: "Weigh House, Market Square", latitude: 53.067025, longitude: -8.819609 },
  { place: "Oughterard", county: "Galway", landmark: "Oughterard Library (former courthouse), Main Street", latitude: 53.427492, longitude: -9.325116 },
  { place: "Carrick-on-Shannon", county: "Leitrim", landmark: "Town Clock (McCann Memorial), Main Street / Bridge Street junction", latitude: 53.9454057, longitude: -8.0957566 },
  { place: "Castlebar", county: "Mayo", landmark: "1798 Monument, The Mall (Ellison Street end)", latitude: 53.8547298, longitude: -9.2998322 },
  { place: "Ballina", county: "Mayo", landmark: "Humbert Memorial Monument, Humbert Street", latitude: 54.1166146, longitude: -9.1536907 },
  { place: "Westport", county: "Mayo", landmark: "Glendenning Monument (St Patrick's column), The Octagon", latitude: 53.7992143, longitude: -9.5247296 },
  { place: "Claremorris", county: "Mayo", landmark: "Town Square (Main Street)", latitude: 53.7199451, longitude: -8.9986818 },
  { place: "Roscommon", county: "Roscommon", landmark: "Harrison Hall (former Courthouse and Market House, now Bank of Ireland), The Square", latitude: 53.6311018, longitude: -8.1905775 },
  { place: "Ballaghaderreen", county: "Roscommon", landmark: "Dillon House (Market Square)", latitude: 53.9020764, longitude: -8.5787595 },
  { place: "Sligo", county: "Sligo", landmark: "W.B. Yeats Statue (Stephen Street)", latitude: 54.2725488, longitude: -8.4738709 },
  { place: "Ballymote", county: "Sligo", landmark: "Ballymote Market House, Lord Edward Street", latitude: 54.088845, longitude: -8.516179 },
  // Ulster (ulster-roi.md)
  { place: "Cavan", county: "Cavan", landmark: "Market Square", latitude: 53.9908856, longitude: -7.3604331 },
  { place: "Cootehill", county: "Cavan", landmark: "The Courthouse (Market Street)", latitude: 54.0747715, longitude: -7.0794053 },
  { place: "Lifford", county: "Donegal", landmark: "County House (Donegal County Council)", latitude: 54.8335875, longitude: -7.4792529 },
  { place: "Letterkenny", county: "Donegal", landmark: "Market Square", latitude: 54.9496221, longitude: -7.7379175 },
  { place: "Buncrana", county: "Donegal", landmark: "Christ Church (Upper Main Street)", latitude: 55.1347241, longitude: -7.4538726 },
  { place: "Ballybofey-Stranorlar", county: "Donegal", landmark: "Balor Arts Centre (Main Street, Ballybofey)", latitude: 54.8003483, longitude: -7.7789526, otherNames: ["Ballybofey and Stranorlar", "Ballybofey"] },
  { place: "Donegal Town", county: "Donegal", landmark: "Four Masters Memorial (The Diamond)", latitude: 54.6538085, longitude: -8.1104018 },
  { place: "Bundoran", county: "Donegal", landmark: "Main Street (by the Diamond)", latitude: 54.4794661, longitude: -8.2771556 },
  { place: "Monaghan", county: "Monaghan", landmark: "The Diamond", latitude: 54.248537, longitude: -6.968756 },
  { place: "Carrickmacross", county: "Monaghan", landmark: "Market Square / Market House (Main Street)", latitude: 53.9776985, longitude: -6.7195368 },
];

// A name as two are compared: without capitals or accents, and without "City" or "Town" at its end.
// Google's "Kilkenny" is the research's Kilkenny City, and its "Carrick-On-Shannon" is
// Carrick-on-Shannon.
function bare(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // the accents, which NFKD sets apart from their letters
    .toLowerCase()
    .trim()
    .replace(/ (city|town)$/, "");
}

// Each town by each of its names. No two towns share one (tests/landmarks.test.ts).
const BY_NAME = new Map(LANDMARKS.flatMap((landmark) => [landmark.place, ...(landmark.otherNames ?? [])].map((name) => [bare(name), landmark])));

// How far from a town's landmark Google can put the town. Its suggestions for the 115 towns were
// 3.8 km from the landmark at most, and the nearest place with a town's name that is another place
// was 14 km from it.
const WITHIN_KM = 5;

// Kilometres between two points over the earth's surface (the haversine formula).
function kmBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const half =
    Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(half));
}

// The town that one of Google's suggestions is, from its name and where Google puts it, or null.
// The name alone is not enough: there is a Kilrush in Co. Tipperary, 126 km from Kilrush in
// Co. Clare. Nor is the distance: Rathmines is 3 km from the GPO and is not Dublin City.
export function landmarkNamed(name: string, latitude: number, longitude: number): Landmark | null {
  const landmark = BY_NAME.get(bare(name));
  return landmark && kmBetween(landmark, { latitude, longitude }) <= WITHIN_KM ? landmark : null;
}

// The landmark a search measures from, or null. The page address has nothing of its own to say so:
// it is such a search when its place starts with one of the town's names, as Google's label does
// ("Kilrush, County Clare"), and its point is the landmark's, rounded as every point is
// (lib/near.ts). A link made before the landmarks, with Google's own point, is one only where that
// point rounds to the landmark's.
export function searchLandmark({ place, near }: { place: string; near: string }): Landmark | null {
  const landmark = BY_NAME.get(bare(place.split(",")[0]));
  return landmark && near === nearFrom(landmark.latitude, landmark.longitude) ? landmark : null;
}
