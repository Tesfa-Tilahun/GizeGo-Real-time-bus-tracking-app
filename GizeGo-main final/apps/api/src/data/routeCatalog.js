/** Addis Ababa stop coordinates (approximate) for route seeding. */
export const PLACES = {
  "4 Kilo": { latitude: 9.0325, longitude: 38.7639 },
  "Akaki Korkoro": { latitude: 8.862, longitude: 38.789 },
  "Aleltu": { latitude: 9.045, longitude: 38.92 },
  "Alem Bank": { latitude: 8.975, longitude: 38.715 },
  "Arat Kilo": { latitude: 9.0325, longitude: 38.7639 },
  "Autobis Tera": { latitude: 9.0245, longitude: 38.7355 },
  "Ayer Tena": { latitude: 8.995, longitude: 38.705 },
  "Bela Mazorya": { latitude: 9.015, longitude: 38.755 },
  "Bole Bulbula": { latitude: 8.985, longitude: 38.805 },
  "Brass Clinic (Bole)": { latitude: 8.99, longitude: 38.79 },
  "Dil Ber": { latitude: 9.02, longitude: 38.74 },
  "Dire Sololiya": { latitude: 9.055, longitude: 38.72 },
  "Entoto Mariam": { latitude: 9.065, longitude: 38.755 },
  "Eyesus": { latitude: 9.038, longitude: 38.728 },
  "File Doro": { latitude: 9.025, longitude: 38.742 },
  "Gelan Condominium": { latitude: 8.915, longitude: 38.755 },
  "German Square": { latitude: 8.995, longitude: 38.735 },
  "Gurara": { latitude: 9.055, longitude: 38.745 },
  "Haile Garment": { latitude: 8.965, longitude: 38.725 },
  "Hanna Mariam": { latitude: 9.005, longitude: 38.78 },
  "Jemmo 2": { latitude: 8.955, longitude: 38.695 },
  "Jemo 1": { latitude: 8.96, longitude: 38.7 },
  "Kality Meneharia": { latitude: 8.885, longitude: 38.765 },
  "Kara Kore": { latitude: 8.935, longitude: 38.685 },
  "Kechenie": { latitude: 9.04, longitude: 38.77 },
  "Kera": { latitude: 8.985, longitude: 38.745 },
  "Kidane Mihret": { latitude: 9.028, longitude: 38.748 },
  "Kotebe Gebriel": { latitude: 9.045, longitude: 38.785 },
  "Kotebe Teachers College": { latitude: 9.042, longitude: 38.782 },
  "Lafto": { latitude: 8.975, longitude: 38.71 },
  "Lamberet": { latitude: 9.035, longitude: 38.725 },
  "Legehar (Old Train Station)": { latitude: 9.012, longitude: 38.752 },
  "Megenagna": { latitude: 9.02, longitude: 38.795 },
  "Mekanisa Kore": { latitude: 8.965, longitude: 38.715 },
  "Mexico": { latitude: 9.0108, longitude: 38.7372 },
  "Piassa Arada": { latitude: 9.0337, longitude: 38.75 },
  "Raguel Church": { latitude: 9.018, longitude: 38.758 },
  "Sansusi": { latitude: 9.048, longitude: 38.735 },
  "Sebeta": { latitude: 8.92, longitude: 38.62 },
  "Sefera": { latitude: 9.05, longitude: 38.74 },
  "Shero Meda": { latitude: 9.048, longitude: 38.728 },
  "St. George Church": { latitude: 9.033, longitude: 38.752 },
  "Sululta": { latitude: 9.08, longitude: 38.68 },
  "Summit Condominiums": { latitude: 9.055, longitude: 38.805 },
  "Tafo Square": { latitude: 9.025, longitude: 38.815 },
  "Yerer Goro": { latitude: 9.035, longitude: 38.825 },
  "Yeshi Debele": { latitude: 9.04, longitude: 38.738 },
  kera: { latitude: 8.985, longitude: 38.745 },
  "Addisu Gebeya": { latitude: 9.055, longitude: 38.715 },
};

export function placeCoords(name) {
  const hit = PLACES[name];
  if (hit) return hit;
  return { latitude: 9.03, longitude: 38.75 };
}

export function parseDurationMinutes(text) {
  const h = text.match(/(\d+)\s*h/i);
  const m = text.match(/(\d+)\s*m/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

export function parseDistanceMeters(kmText) {
  return Math.round(parseFloat(kmText) * 1000);
}

/**
 * Official Addis / Anbessa route catalog from GizeGo reference data.
 * @type {{ code: string, origin: string, destination: string, duration: string, distanceKm: number, fareEtb: number }[]}
 */
export const ROUTE_CATALOG = [
  { code: "A01", origin: "Shero Meda", destination: "Mexico", duration: "41m", distanceKm: 13.5, fareEtb: 34 },
  { code: "A02", origin: "Mexico", destination: "Jemo 1", duration: "31m", distanceKm: 10.3, fareEtb: 26 },
  { code: "A04", origin: "Sefera", destination: "Mexico", duration: "48m", distanceKm: 16.0, fareEtb: 40 },
  { code: "A05", origin: "Mexico", destination: "Lafto", duration: "44m", distanceKm: 14.8, fareEtb: 37 },
  { code: "A08", origin: "Gurara", destination: "4 Kilo", duration: "21m", distanceKm: 7.2, fareEtb: 18 },
  { code: "A09", origin: "Mexico", destination: "Alem Bank", duration: "45m", distanceKm: 15.0, fareEtb: 38 },
  { code: "A10", origin: "Mexico", destination: "Haile Garment", duration: "36m", distanceKm: 12.1, fareEtb: 30 },
  { code: "A18", origin: "Piassa Arada", destination: "Jemmo 2", duration: "48m", distanceKm: 16.1, fareEtb: 40 },
  { code: "A24", origin: "Mexico", destination: "Megenagna", duration: "25m", distanceKm: 8.3, fareEtb: 21 },
  { code: "AB001", origin: "Tafo Square", destination: "Piassa Arada", duration: "54m", distanceKm: 18.1, fareEtb: 45 },
  { code: "AB002", origin: "Mekanisa Kore", destination: "Autobis Tera", duration: "28m", distanceKm: 9.2, fareEtb: 23 },
  { code: "AB003", origin: "Ayer Tena", destination: "Piassa Arada", duration: "34m", distanceKm: 11.2, fareEtb: 28 },
  { code: "AB004", origin: "Kality Meneharia", destination: "Autobis Tera", duration: "1h 0m", distanceKm: 20.1, fareEtb: 50 },
  { code: "AB005", origin: "St. George Church", destination: "Mekanisa Kore", duration: "46m", distanceKm: 15.3, fareEtb: 38 },
  { code: "AB006", origin: "kera", destination: "Addisu Gebeya", duration: "44m", distanceKm: 14.7, fareEtb: 37 },
  { code: "AB007", origin: "Megenagna", destination: "Aleltu", duration: "2h 20m", distanceKm: 46.6, fareEtb: 117 },
  { code: "AB008", origin: "Raguel Church", destination: "Kechenie", duration: "15m", distanceKm: 5.1, fareEtb: 13 },
  { code: "AB009", origin: "Piassa Arada", destination: "Brass Clinic (Bole)", duration: "22m", distanceKm: 7.4, fareEtb: 19 },
  { code: "AB010", origin: "Kotebe Teachers College", destination: "Piassa Arada", duration: "45m", distanceKm: 14.9, fareEtb: 37 },
  { code: "AB011", origin: "Summit Condominiums", destination: "Piassa Arada", duration: "53m", distanceKm: 17.8, fareEtb: 44 },
  { code: "AB012", origin: "Gurara", destination: "Autobis Tera", duration: "39m", distanceKm: 13.2, fareEtb: 33 },
  { code: "AB013", origin: "Raguel Church", destination: "Bela Mazorya", duration: "31m", distanceKm: 10.4, fareEtb: 26 },
  { code: "AB014", origin: "Piassa Arada", destination: "Bole Bulbula", duration: "54m", distanceKm: 18.3, fareEtb: 46 },
  { code: "AB015", origin: "Raguel Church", destination: "Megenagna", duration: "37m", distanceKm: 12.3, fareEtb: 31 },
  { code: "AB016", origin: "Kidane Mihret", destination: "Raguel Church", duration: "25m", distanceKm: 8.2, fareEtb: 21 },
  { code: "AB017", origin: "Entoto Mariam", destination: "Raguel Church", duration: "49m", distanceKm: 16.3, fareEtb: 41 },
  { code: "AB018", origin: "Yeshi Debele", destination: "Autobis Tera", duration: "31m", distanceKm: 10.5, fareEtb: 26 },
  { code: "AB019", origin: "Sansusi", destination: "Piassa Arada", duration: "44m", distanceKm: 14.8, fareEtb: 37 },
  { code: "AB020", origin: "Raguel Church", destination: "Dil Ber", duration: "20m", distanceKm: 6.6, fareEtb: 17 },
  { code: "AB021", origin: "File Doro", destination: "Autobis Tera", duration: "23m", distanceKm: 7.7, fareEtb: 19 },
  { code: "AB022", origin: "Summit Condominiums", destination: "Legehar (Old Train Station)", duration: "1h 21m", distanceKm: 27.0, fareEtb: 67 },
  { code: "AB023", origin: "Lamberet", destination: "Autobis Tera", duration: "38m", distanceKm: 12.7, fareEtb: 32 },
  { code: "AB024", origin: "Dire Sololiya", destination: "Autobis Tera", duration: "43m", distanceKm: 15.2, fareEtb: 38 },
  { code: "AB025", origin: "Legehar (Old Train Station)", destination: "Akaki Korkoro", duration: "1h 21m", distanceKm: 26.9, fareEtb: 67 },
  { code: "AB026", origin: "Sebeta", destination: "Autobis Tera", duration: "1h 49m", distanceKm: 36.3, fareEtb: 91 },
  { code: "AB027", origin: "Mexico", destination: "Gelan Condominium", duration: "1h 22m", distanceKm: 27.4, fareEtb: 68 },
  { code: "AB028", origin: "Sansusi", destination: "Autobis Tera", duration: "37m", distanceKm: 12.2, fareEtb: 30 },
  { code: "AB029", origin: "Yerer Goro", destination: "Mexico", duration: "36m", distanceKm: 12.0, fareEtb: 30 },
  { code: "AB030", origin: "Sululta", destination: "Autobis Tera", duration: "1h 41m", distanceKm: 33.7, fareEtb: 84 },
  { code: "AB031", origin: "Shero Meda", destination: "Legehar (Old Train Station)", duration: "35m", distanceKm: 11.7, fareEtb: 29 },
  { code: "AB032", origin: "Hanna Mariam", destination: "Legehar (Old Train Station)", duration: "55m", distanceKm: 18.3, fareEtb: 46 },
  { code: "AB033", origin: "Kotebe Gebriel", destination: "Arat Kilo", duration: "58m", distanceKm: 19.5, fareEtb: 49 },
  { code: "AB034", origin: "German Square", destination: "Autobis Tera", duration: "43m", distanceKm: 14.2, fareEtb: 36 },
  { code: "AB036", origin: "Legehar (Old Train Station)", destination: "Kara Kore", duration: "53m", distanceKm: 17.5, fareEtb: 44 },
  { code: "AB036S", origin: "Mexico", destination: "Kara Kore", duration: "55m", distanceKm: 17.6, fareEtb: 44 },
  { code: "AB037", origin: "Yeshi Debele", destination: "St. George Church", duration: "35m", distanceKm: 11.8, fareEtb: 29 },
  { code: "AB040", origin: "Raguel Church", destination: "Kera", duration: "44m", distanceKm: 14.8, fareEtb: 37 },
  { code: "AB041", origin: "Eyesus", destination: "Autobis Tera", duration: "39m", distanceKm: 13.0, fareEtb: 33 },
];

export const FLEET_OPERATORS = ["ambessa", "addis", "shega"];

export const BUS_STATUSES = ["active", "maintenance", "inactive", "out_of_service"];
