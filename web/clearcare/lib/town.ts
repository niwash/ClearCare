// lib/town.ts
// The town a home is in, for its search card and its pin on the map. The tests load this file as it
// is (tests/town.test.ts), so its import is named with its extension.
import { asEircode } from "./eircode.ts";

// The register has no field for the town, so it's the address's last part that isn't an Eircode or
// the county. The address usually starts with the centre's name, which is shown beside it already.
// asEircode decides what an Eircode is: the register prints two with a letter O for 0 (A98 C2CO).
// Only a full one counts, so that a part such as "D12" is not dropped as a routing key.
export function town({ centre_name, address, county }: { centre_name: string; address: string; county: string }) {
  const prefix = `${centre_name},`.toLowerCase();
  const rest = address.toLowerCase().startsWith(prefix) ? address.slice(prefix.length) : address;
  const parts = rest
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && asEircode(part)?.length !== 7 && !new RegExp(`^(co\\.?|county)\\s+${county}$`, "i").test(part) && part.toLowerCase() !== county.toLowerCase());
  return parts.at(-1) ?? null;
}

// "Celbridge, Co. Kildare", or "Co. Kildare" when the address names no town.
export function townAndCounty(centre: { centre_name: string; address: string; county: string }) {
  return [town(centre), `Co. ${centre.county}`].filter(Boolean).join(", ");
}
