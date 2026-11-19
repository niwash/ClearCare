// lib/support-offices.ts
// The HSE's local Nursing Homes Support Offices, which process Fair Deal applications, and which
// office each county's families apply to (CCARE-258). Read by the Support Services page's finder.

// One office, laid out like the HSE's own list: the address one line per row, then every phone line.
export type SupportOffice = {
  area: string;
  address?: string[];
  phones: string[];
  email?: string;
  hours?: string;
};

export const FAIR_DEAL_CONTACT_URL = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/contact/";

// From the HSE's Fair Deal contact page (FAIR_DEAL_CONTACT_URL), checked 13 Nov 2026. Phone numbers
// are spaced the same way throughout. Longford and Westmeath's listed address is a Tullamore street
// with a Tipperary Eircode, so it's left out.
export const SUPPORT_OFFICES = [
  {
    area: "Carlow and Kilkenny",
    address: ["Community Services", "James's Green", "Kilkenny", "R95 RP26"],
    phones: ["056 778 4761", "056 778 4763", "056 778 4709"],
  },
  {
    area: "Cavan and Monaghan",
    address: ["HSE Offices", "Town Hall Street", "Cavan", "H12 W3R2"],
    phones: ["049 437 7119", "049 437 7115", "049 437 7114", "049 437 7113"],
  },
  {
    area: "Cork and Kerry",
    address: ["Floor 1, Áras Sláinte", "Wilton Road", "Cork", "T12 XRR0"],
    phones: ["021 492 3536", "021 492 3537", "021 492 3538", "021 492 3539", "021 492 3540", "021 492 3541", "021 492 3542"],
  },
  {
    area: "Donegal",
    address: ["Donegal PCCC HQ", "St Joseph's Hospital", "Stranorlar, Lifford", "Co. Donegal", "F93 FCR6"],
    phones: ["074 919 1734", "074 919 1740", "074 919 1737"],
  },
  {
    area: "Dublin North City and County",
    address: ["Older Person Services", "Nexus Building, Units 4 & 5", "Blanchardstown Corporate Park", "Dublin 15", "D15 CF9K"],
    phones: ["01 897 6121"],
  },
  {
    area: "Dublin South, Wicklow and Kildare",
    address: ["Hawthorn House", "Millennium Park", "Naas, Co. Kildare", "W91 FY53"],
    phones: ["045 920 000"],
  },
  {
    area: "Galway",
    address: ["Lá Nua, Ballybane Neighbourhood Village", "Castlepark Road, Ballybane", "Galway", "H91 VE03"],
    phones: ["091 748 490"],
    email: "fairdeal.galway@hse.ie",
    hours: "Phones open 10am–12pm and 3–4pm, Monday to Friday",
  },
  {
    area: "Laois and Offaly",
    address: ["Bury Quay", "Tullamore", "Co. Offaly", "R35 NF29"],
    phones: ["057 935 9734", "057 932 7832"],
  },
  {
    area: "Limerick, Clare and North Tipperary",
    address: ["St Joseph's Hospital", "Mulgrave Street", "Limerick", "V94 C8DV"],
    phones: ["061 461 499"],
  },
  { area: "Longford and Westmeath", phones: ["044 939 4995"], email: "LPF.RespiteLW@hse.ie" },
  {
    area: "Louth and Meath",
    address: ["Unit 3, Ardee Business Park", "Hale Street, Ardee", "Co. Louth", "A92 VC53"],
    phones: ["041 687 1515", "041 687 1525"],
  },
  {
    area: "Mayo",
    address: ["St Mary's Headquarters", "Castlebar", "Co. Mayo", "F23 HP58"],
    phones: ["094 904 9176"],
  },
  {
    area: "Roscommon",
    address: ["Government Buildings", "Convent Road", "Roscommon", "F42 VX53"],
    phones: ["090 663 7561", "090 663 7546"],
  },
  {
    area: "Sligo and Leitrim",
    address: ["Markievicz House", "Barrack Street", "Sligo", "F91 XC84"],
    phones: ["071 932 1337"],
  },
  {
    // The HSE lists it as Tipperary South; North Tipperary is the Limerick office's.
    area: "South Tipperary",
    address: ["Community Care Centre", "Western Road, Clonmel", "Co. Tipperary", "E91 HT96"],
    phones: ["052 617 7283"],
  },
  {
    area: "Waterford",
    address: ["Waterford Community Services", "Cork Road", "Waterford", "X91 VX09"],
    phones: ["051 842 963"],
  },
  {
    area: "Wexford",
    address: ["Wexford Community Service", "Georges Street", "Wexford", "Y35 AW96"],
    phones: ["053 911 4316", "053 911 4315"],
  },
] as const satisfies readonly SupportOffice[];

type OfficeArea = (typeof SUPPORT_OFFICES)[number]["area"];

// Each county's office, by the area the HSE names it after. A family knows their county, not the
// HSE's areas, so they choose that. Dublin and Tipperary are split between two offices, and the
// HSE doesn't say where the line falls, so both are shown for them.
const COUNTY_OFFICES: Record<string, OfficeArea[]> = {
  Carlow: ["Carlow and Kilkenny"],
  Cavan: ["Cavan and Monaghan"],
  Clare: ["Limerick, Clare and North Tipperary"],
  Cork: ["Cork and Kerry"],
  Donegal: ["Donegal"],
  Dublin: ["Dublin North City and County", "Dublin South, Wicklow and Kildare"],
  Galway: ["Galway"],
  Kerry: ["Cork and Kerry"],
  Kildare: ["Dublin South, Wicklow and Kildare"],
  Kilkenny: ["Carlow and Kilkenny"],
  Laois: ["Laois and Offaly"],
  Leitrim: ["Sligo and Leitrim"],
  Limerick: ["Limerick, Clare and North Tipperary"],
  Longford: ["Longford and Westmeath"],
  Louth: ["Louth and Meath"],
  Mayo: ["Mayo"],
  Meath: ["Louth and Meath"],
  Monaghan: ["Cavan and Monaghan"],
  Offaly: ["Laois and Offaly"],
  Roscommon: ["Roscommon"],
  Sligo: ["Sligo and Leitrim"],
  Tipperary: ["Limerick, Clare and North Tipperary", "South Tipperary"],
  Waterford: ["Waterford"],
  Westmeath: ["Longford and Westmeath"],
  Wexford: ["Wexford"],
  Wicklow: ["Dublin South, Wicklow and Kildare"],
};

// The office or offices a county applies to; none for a name that isn't a county.
export function officesForCounty(county: string): SupportOffice[] {
  const areas = COUNTY_OFFICES[county] ?? [];
  return SUPPORT_OFFICES.filter((office) => areas.includes(office.area));
}

// Which side of a split county each office covers, for the note above them.
export const SPLIT_COUNTY_NOTE: Record<string, string> = {
  Dublin: "Dublin has two offices: one for the north of the city and county, one for the south.",
  Tipperary: "Tipperary has two offices: North Tipperary applies through Limerick, South Tipperary through Clonmel.",
};
