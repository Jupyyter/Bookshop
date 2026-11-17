// Every county seat in Romania (plus Bucharest), with its county code and coordinates.
// Used to put the buyer's town on the tracking map. Smaller towns fall back to their county seat,
// so the map position is approximate for them.

export type Place = { name: string; lat: number; lng: number };
type City = Place & { county: string; countyName: string; aliases?: string[] };

const CITIES: City[] = [
  { name: "Bucharest", county: "B", countyName: "București", lat: 44.4268, lng: 26.1025, aliases: ["Bucuresti", "București"] },
  { name: "Alba Iulia", county: "AB", countyName: "Alba", lat: 46.0667, lng: 23.5833 },
  { name: "Arad", county: "AR", countyName: "Arad", lat: 46.1866, lng: 21.3123 },
  { name: "Pitești", county: "AG", countyName: "Argeș", lat: 44.8565, lng: 24.8692 },
  { name: "Bacău", county: "BC", countyName: "Bacău", lat: 46.567, lng: 26.9146 },
  { name: "Oradea", county: "BH", countyName: "Bihor", lat: 47.0465, lng: 21.9189 },
  { name: "Bistrița", county: "BN", countyName: "Bistrița-Năsăud", lat: 47.1357, lng: 24.493 },
  { name: "Botoșani", county: "BT", countyName: "Botoșani", lat: 47.7486, lng: 26.6694 },
  { name: "Brașov", county: "BV", countyName: "Brașov", lat: 45.6427, lng: 25.5887 },
  { name: "Brăila", county: "BR", countyName: "Brăila", lat: 45.2692, lng: 27.9575 },
  { name: "Buzău", county: "BZ", countyName: "Buzău", lat: 45.15, lng: 26.8333 },
  { name: "Reșița", county: "CS", countyName: "Caraș-Severin", lat: 45.3008, lng: 21.8892 },
  { name: "Călărași", county: "CL", countyName: "Călărași", lat: 44.2, lng: 27.3333 },
  { name: "Cluj-Napoca", county: "CJ", countyName: "Cluj", lat: 46.7712, lng: 23.6236 },
  { name: "Constanța", county: "CT", countyName: "Constanța", lat: 44.1598, lng: 28.6348 },
  { name: "Sfântu Gheorghe", county: "CV", countyName: "Covasna", lat: 45.8667, lng: 25.7833 },
  { name: "Târgoviște", county: "DB", countyName: "Dâmbovița", lat: 44.9254, lng: 25.4567 },
  { name: "Craiova", county: "DJ", countyName: "Dolj", lat: 44.3302, lng: 23.7949 },
  { name: "Galați", county: "GL", countyName: "Galați", lat: 45.4353, lng: 28.008 },
  { name: "Giurgiu", county: "GR", countyName: "Giurgiu", lat: 43.9037, lng: 25.9699 },
  { name: "Târgu Jiu", county: "GJ", countyName: "Gorj", lat: 45.0333, lng: 23.2833 },
  { name: "Miercurea Ciuc", county: "HR", countyName: "Harghita", lat: 46.3594, lng: 25.8018 },
  { name: "Deva", county: "HD", countyName: "Hunedoara", lat: 45.8833, lng: 22.9 },
  { name: "Slobozia", county: "IL", countyName: "Ialomița", lat: 44.5667, lng: 27.3667 },
  { name: "Iași", county: "IS", countyName: "Iași", lat: 47.1585, lng: 27.6014 },
  { name: "Buftea", county: "IF", countyName: "Ilfov", lat: 44.5667, lng: 25.95 },
  { name: "Baia Mare", county: "MM", countyName: "Maramureș", lat: 47.6567, lng: 23.585 },
  { name: "Drobeta-Turnu Severin", county: "MH", countyName: "Mehedinți", lat: 44.6319, lng: 22.6561 },
  { name: "Târgu Mureș", county: "MS", countyName: "Mureș", lat: 46.5425, lng: 24.5575 },
  { name: "Piatra Neamț", county: "NT", countyName: "Neamț", lat: 46.9275, lng: 26.3708 },
  { name: "Slatina", county: "OT", countyName: "Olt", lat: 44.43, lng: 24.3717 },
  { name: "Ploiești", county: "PH", countyName: "Prahova", lat: 44.9367, lng: 26.0129 },
  { name: "Satu Mare", county: "SM", countyName: "Satu Mare", lat: 47.79, lng: 22.89 },
  { name: "Zalău", county: "SJ", countyName: "Sălaj", lat: 47.1911, lng: 23.0572 },
  { name: "Sibiu", county: "SB", countyName: "Sibiu", lat: 45.7983, lng: 24.1256 },
  { name: "Suceava", county: "SV", countyName: "Suceava", lat: 47.6514, lng: 26.2556 },
  { name: "Alexandria", county: "TR", countyName: "Teleorman", lat: 43.9686, lng: 25.3333 },
  { name: "Timișoara", county: "TM", countyName: "Timiș", lat: 45.7489, lng: 21.2087 },
  { name: "Tulcea", county: "TL", countyName: "Tulcea", lat: 45.1667, lng: 28.8 },
  { name: "Vaslui", county: "VS", countyName: "Vaslui", lat: 46.6333, lng: 27.7333 },
  { name: "Râmnicu Vâlcea", county: "VL", countyName: "Vâlcea", lat: 45.1047, lng: 24.3756 },
  { name: "Focșani", county: "VN", countyName: "Vrancea", lat: 45.6967, lng: 27.1858 },
];

export const BUCHAREST: Place = CITIES[0];

// Every county (județ), for the county dropdown in the address form. Bucharest first, then A to Z.
export const COUNTIES: { code: string; name: string }[] = [
  { code: "B", name: "București" },
  ...CITIES.slice(1)
    .map((c) => ({ code: c.county, name: c.countyName }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro")),
];

export function countyName(code: string): string {
  return COUNTIES.find((c) => c.code === code)?.name ?? code;
}

// "Cluj-Napoca", "cluj napoca" and "CLUJ-NAPOCA" all become "clujnapoca"; "Iași" becomes "iasi".
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Finds the buyer's town: first by name ("Bucuresti Sector 3" counts as Bucharest),
// then by county ("CJ" or "Cluj"), and as a last resort uses Bucharest.
export function findPlace(city?: string | null, county?: string | null): Place {
  const cityKey = city ? normalize(city) : "";
  const countyKey = county ? normalize(county) : "";
  const names = (c: City) => [c.name, ...(c.aliases ?? [])].map(normalize);

  const match =
    (cityKey && CITIES.find((c) => names(c).includes(cityKey))) ||
    (cityKey && CITIES.find((c) => names(c).some((n) => cityKey.startsWith(n)))) ||
    (countyKey && CITIES.find((c) => normalize(c.county) === countyKey || normalize(c.countyName) === countyKey));

  const found = match || BUCHAREST;
  // Keep the buyer's own spelling of the town as the label, with the best coordinates we have.
  return { name: city?.trim() || found.name, lat: found.lat, lng: found.lng };
}

// "CJ", "Cluj" or "cluj" → "CJ". Stripe's payment page may give either the code or the name.
export function countyCode(value?: string | null): string | null {
  if (!value) return null;
  const key = normalize(value);
  return CITIES.find((c) => normalize(c.county) === key || normalize(c.countyName) === key)?.county ?? null;
}

// Straight-line distance in kilometres between two points on Earth (the haversine formula).
export function distanceKm(a: Place, b: Place) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
