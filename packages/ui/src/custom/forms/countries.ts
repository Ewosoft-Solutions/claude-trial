/**
 * A curated country list for the `phone` item's dial-code picker. Flags render
 * from the ISO-3166 alpha-2 code as regional-indicator emoji — no image assets.
 * Nigeria leads (the product's home market); the rest cover West Africa + the
 * common global destinations. Extend as needed.
 */
export interface Country {
  iso2: string;
  name: string;
  dial: string;
}

export const COUNTRIES: Country[] = [
  { iso2: 'NG', name: 'Nigeria', dial: '+234' },
  { iso2: 'GH', name: 'Ghana', dial: '+233' },
  { iso2: 'KE', name: 'Kenya', dial: '+254' },
  { iso2: 'ZA', name: 'South Africa', dial: '+27' },
  { iso2: 'EG', name: 'Egypt', dial: '+20' },
  { iso2: 'BJ', name: 'Benin', dial: '+229' },
  { iso2: 'TG', name: 'Togo', dial: '+228' },
  { iso2: 'CI', name: "Côte d'Ivoire", dial: '+225' },
  { iso2: 'CM', name: 'Cameroon', dial: '+237' },
  { iso2: 'SN', name: 'Senegal', dial: '+221' },
  { iso2: 'NE', name: 'Niger', dial: '+227' },
  { iso2: 'TD', name: 'Chad', dial: '+235' },
  { iso2: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso2: 'US', name: 'United States', dial: '+1' },
  { iso2: 'CA', name: 'Canada', dial: '+1' },
  { iso2: 'FR', name: 'France', dial: '+33' },
  { iso2: 'DE', name: 'Germany', dial: '+49' },
  { iso2: 'IT', name: 'Italy', dial: '+39' },
  { iso2: 'ES', name: 'Spain', dial: '+34' },
  { iso2: 'NL', name: 'Netherlands', dial: '+31' },
  { iso2: 'IE', name: 'Ireland', dial: '+353' },
  { iso2: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso2: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { iso2: 'IN', name: 'India', dial: '+91' },
  { iso2: 'CN', name: 'China', dial: '+86' },
  { iso2: 'AU', name: 'Australia', dial: '+61' },
  { iso2: 'BR', name: 'Brazil', dial: '+55' },
];

/** Regional-indicator flag emoji for an ISO-3166 alpha-2 code. */
export function flagEmoji(iso2: string): string {
  const cc = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return cc.replace(/./g, (c) =>
    String.fromCodePoint(127397 + c.charCodeAt(0)),
  );
}

/** The country whose dial code matches, else Nigeria. */
export function countryByDial(dial: string): Country {
  return COUNTRIES.find((c) => c.dial === dial) ?? COUNTRIES[0]!;
}
