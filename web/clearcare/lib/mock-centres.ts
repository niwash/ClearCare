// lib/mock-centres.ts
// Invented centres in the shape GET /centres returns, for testing the search page before the
// API (CCARE-45) is running. Only Elm Hall comes from the example in the contract.
// Each one covers a case the page has to handle; see the comments.
import type { CentreSummary, RegisterSnapshot } from "./search";

const hiqaUrl = (slug: string) => `https://www.hiqa.ie/areas-we-work/find-a-centre/${slug}`;

export const MOCK_SNAPSHOT: RegisterSnapshot = {
  fetched_at: "2026-10-05T06:12:54Z",
  url: "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
  sha256: "c24a105a0000000000000000000000000000000000000000000000000000mock",
};

export const MOCK_CENTRES: CentreSummary[] = [
  {
    centre_id: "34",
    centre_name: "Elm Hall Nursing Home",
    address: "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX",
    county: "Kildare",
    eircode: "W23P6EX",
    maximum_occupancy: 62,
    hiqa_url: hiqaUrl("elm-hall-nursing-home"),
  },
  {
    // Accent: "aras" should find it.
    centre_id: "101",
    centre_name: "Áras Mhuire Community Nursing Unit",
    address: "Áras Mhuire, Church Street, Ballina, F26 X2P1",
    county: "Mayo",
    eircode: "F26X2P1",
    maximum_occupancy: 40,
    hiqa_url: hiqaUrl("aras-mhuire-community-nursing-unit"),
  },
  {
    // Apostrophe: "josephs" should find it. "saint" shouldn't.
    centre_id: "102",
    centre_name: "St Joseph's Nursing Home",
    address: "St Joseph's Nursing Home, Main Street, Kilkenny, R95 KX20",
    county: "Kilkenny",
    eircode: "R95KX20",
    maximum_occupancy: 55,
    hiqa_url: hiqaUrl("st-josephs-nursing-home"),
  },
  {
    // "st" shouldn't find it.
    centre_id: "103",
    centre_name: "Saint Joseph's Care Centre",
    address: "Saint Joseph's Care Centre, Ballyfermot Road, D10 HK52",
    county: "Dublin",
    eircode: "D10HK52",
    maximum_occupancy: 78,
    hiqa_url: hiqaUrl("saint-josephs-care-centre"),
  },
  {
    // Dublin address without "Dublin" in it.
    centre_id: "104",
    centre_name: "Beechwood House",
    address: "Beechwood House, Grange Road, Rathfarnham, D14 F9C2",
    county: "Dublin",
    eircode: "D14F9C2",
    maximum_occupancy: 48,
    hiqa_url: hiqaUrl("beechwood-house"),
  },
  {
    // D6W routing key.
    centre_id: "105",
    centre_name: "Terenure Lodge",
    address: "Terenure Lodge, Templeogue Road, Terenure, D6W YT45",
    county: "Dublin",
    eircode: "D6WYT45",
    maximum_occupancy: 36,
    hiqa_url: hiqaUrl("terenure-lodge"),
  },
  {
    // No Eircode.
    centre_id: "106",
    centre_name: "Glenview Residential Care",
    address: "Glenview Residential Care, Knockmore, Ballina",
    county: "Mayo",
    eircode: null,
    maximum_occupancy: 28,
    hiqa_url: hiqaUrl("glenview-residential-care"),
  },
  {
    // No maximum occupancy.
    centre_id: "107",
    centre_name: "Oakfield Nursing Home",
    address: "Oakfield Nursing Home, Model Farm Road, Cork, T12 W8RD",
    county: "Cork",
    eircode: "T12W8RD",
    maximum_occupancy: null,
    hiqa_url: hiqaUrl("oakfield-nursing-home"),
  },
  {
    // Neither Eircode nor maximum occupancy.
    centre_id: "108",
    centre_name: "Riverside Care Home",
    address: "Riverside Care Home, Quay Street, Westport",
    county: "Mayo",
    eircode: null,
    maximum_occupancy: null,
    hiqa_url: hiqaUrl("riverside-care-home"),
  },
  {
    // Address doesn't start with the name.
    centre_id: "109",
    centre_name: "Seaview Nursing Home",
    address: "Coast Road, Salthill, Galway, H91 R2T6",
    county: "Galway",
    eircode: "H91R2T6",
    maximum_occupancy: 64,
    hiqa_url: hiqaUrl("seaview-nursing-home"),
  },
  {
    // Long name, to check the card wraps.
    centre_id: "110",
    centre_name: "The Sacred Heart Residence and Community Nursing Unit for Older Persons",
    address: "The Sacred Heart Residence, Mill Road, Drogheda, A92 E4K7",
    county: "Louth",
    eircode: "A92E4K7",
    maximum_occupancy: 120,
    hiqa_url: hiqaUrl("the-sacred-heart-residence"),
  },
  {
    centre_id: "111",
    centre_name: "Ballina Care Centre",
    address: "Ballina Care Centre, Killala Road, Ballina, F26 P8N3",
    county: "Mayo",
    eircode: "F26P8N3",
    maximum_occupancy: 50,
    hiqa_url: hiqaUrl("ballina-care-centre"),
  },
  {
    centre_id: "112",
    centre_name: "Ard na Gréine Nursing Home",
    address: "Ard na Gréine Nursing Home, Dublin Road, Limerick, V94 C3H8",
    county: "Limerick",
    eircode: "V94C3H8",
    maximum_occupancy: 70,
    hiqa_url: hiqaUrl("ard-na-greine-nursing-home"),
  },
  {
    centre_id: "113",
    centre_name: "Woodlands Nursing Home",
    address: "Woodlands Nursing Home, Dunmore Road, Waterford, X91 D2Y6",
    county: "Waterford",
    eircode: "X91D2Y6",
    maximum_occupancy: 58,
    hiqa_url: hiqaUrl("woodlands-nursing-home"),
  },
];
