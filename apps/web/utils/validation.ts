// Top 10 most common typos for top 10 email providers
const COMMON_EMAIL_TYPOS: { [key: string]: string } = {
  // Gmail typos
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com', 
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmeil.com': 'gmail.com',

  // Yahoo typos
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.cmo': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.om': 'yahoo.com',
  'yhoo.con': 'yahoo.com',
  'yhaoo.con': 'yahoo.com',

  // Outlook typos
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.cmo': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlok.con': 'outlook.com',
  'outlok.cmo': 'outlook.com',
  'outlook.om': 'outlook.com',
  'outlok.om': 'outlook.com',
  'outlok.co': 'outlook.com',
  'outlook.cm': 'outlook.com',

  // iCloud typos
  'icloud.con': 'icloud.com',
  'icloud.cmo': 'icloud.com',
  'icloud.co': 'icloud.com',
  'iclod.com': 'icloud.com',
  'iclod.con': 'icloud.com',
  'iclod.cmo': 'icloud.com',
  'icloud.om': 'icloud.com',
  'iclod.co': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'iclod.om': 'icloud.com',

  // AOL typos
  'aol.con': 'aol.com',
  'aol.cmo': 'aol.com',
  'aol.co': 'aol.com',
  'aol.om': 'aol.com',
  'aol.cm': 'aol.com',

  // Hotmail typos
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.cmo': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmial.con': 'hotmail.com',
  'hotmil.con': 'hotmail.com',
  'hotmail.om': 'hotmail.com',
  'hotmial.cmo': 'hotmail.com',
  'hotmil.cmo': 'hotmail.com',

  // ProtonMail typos
  'protonmail.con': 'protonmail.com',
  'protonmail.cmo': 'protonmail.com',
  'protonmail.co': 'protonmail.com',
  'protonmal.com': 'protonmail.com',
  'protonmal.con': 'protonmail.com',
  'protonmail.om': 'protonmail.com',
  'protonmal.cmo': 'protonmail.com',
  'protonmal.co': 'protonmail.com',
  'protonmail.cm': 'protonmail.com',
  'protonmal.om': 'protonmail.com',

  // Zoho typos
  'zoho.con': 'zoho.com',
  'zoho.cmo': 'zoho.com',
  'zoho.co': 'zoho.com',
  'zoho.om': 'zoho.com',
  'zoho.cm': 'zoho.com',

  // Yandex typos
  'yandex.con': 'yandex.com',
  'yandex.cmo': 'yandex.com',
  'yandex.co': 'yandex.com',
  'yandex.om': 'yandex.com',
  'yandex.cm': 'yandex.com',

  // Tutanota typos
  'tutanota.con': 'tutanota.com',
  'tutanota.cmo': 'tutanota.com',
  'tutanota.co': 'tutanota.com',
  'tutanota.om': 'tutanota.com',
  'tutanota.cm': 'tutanota.com'
};

// Email validation with typo detection
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// US phone validation (accepts (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx, xxxxxxxxxx)
export function isValidUSPhone(phone: string): boolean {
  return /^(\+1[\s.-]?)?(\([2-9][0-9]{2}\)|[2-9][0-9]{2})[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}$/.test(phone.trim());
}

// --- Country phone data ---

export interface CountryPhoneData {
  name: string;
  iso: string;
  dialCode: string;
  flag: string;
  digitCount: number; // local digits expected (after country code)
  format: string;     // 'X' = digit placeholder, other chars are literal separators
}

export const COUNTRIES: CountryPhoneData[] = [
  { name: 'United States',        iso: 'US', dialCode: '1',   flag: '🇺🇸', digitCount: 10, format: 'XXX-XXX-XXXX' },
  { name: 'Canada',               iso: 'CA', dialCode: '1',   flag: '🇨🇦', digitCount: 10, format: 'XXX-XXX-XXXX' },
  { name: 'United Kingdom',       iso: 'GB', dialCode: '44',  flag: '🇬🇧', digitCount: 10, format: 'XXXX XXXXXX' },
  { name: 'Australia',            iso: 'AU', dialCode: '61',  flag: '🇦🇺', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Germany',              iso: 'DE', dialCode: '49',  flag: '🇩🇪', digitCount: 10, format: 'XXX XXXXXXX' },
  { name: 'France',               iso: 'FR', dialCode: '33',  flag: '🇫🇷', digitCount: 9,  format: 'X XX XX XX XX' },
  { name: 'Spain',                iso: 'ES', dialCode: '34',  flag: '🇪🇸', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Italy',                iso: 'IT', dialCode: '39',  flag: '🇮🇹', digitCount: 10, format: 'XXX XXXXXXX' },
  { name: 'Netherlands',          iso: 'NL', dialCode: '31',  flag: '🇳🇱', digitCount: 9,  format: 'X XXXXXXXX' },
  { name: 'Belgium',              iso: 'BE', dialCode: '32',  flag: '🇧🇪', digitCount: 9,  format: 'XXX XX XX XX' },
  { name: 'Switzerland',          iso: 'CH', dialCode: '41',  flag: '🇨🇭', digitCount: 9,  format: 'XX XXX XX XX' },
  { name: 'Austria',              iso: 'AT', dialCode: '43',  flag: '🇦🇹', digitCount: 10, format: 'XXX XXXXXXX' },
  { name: 'Sweden',               iso: 'SE', dialCode: '46',  flag: '🇸🇪', digitCount: 9,  format: 'XX-XXX XX XX' },
  { name: 'Norway',               iso: 'NO', dialCode: '47',  flag: '🇳🇴', digitCount: 8,  format: 'XXXX XXXX' },
  { name: 'Denmark',              iso: 'DK', dialCode: '45',  flag: '🇩🇰', digitCount: 8,  format: 'XXXX XXXX' },
  { name: 'Finland',              iso: 'FI', dialCode: '358', flag: '🇫🇮', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Portugal',             iso: 'PT', dialCode: '351', flag: '🇵🇹', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Ireland',              iso: 'IE', dialCode: '353', flag: '🇮🇪', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Poland',               iso: 'PL', dialCode: '48',  flag: '🇵🇱', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Russia',               iso: 'RU', dialCode: '7',   flag: '🇷🇺', digitCount: 10, format: 'XXX XXX-XX-XX' },
  { name: 'Ukraine',              iso: 'UA', dialCode: '380', flag: '🇺🇦', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Turkey',               iso: 'TR', dialCode: '90',  flag: '🇹🇷', digitCount: 10, format: 'XXX XXX XXXX' },
  { name: 'Israel',               iso: 'IL', dialCode: '972', flag: '🇮🇱', digitCount: 9,  format: 'XX-XXX-XXXX' },
  { name: 'Saudi Arabia',         iso: 'SA', dialCode: '966', flag: '🇸🇦', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'United Arab Emirates', iso: 'AE', dialCode: '971', flag: '🇦🇪', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'India',                iso: 'IN', dialCode: '91',  flag: '🇮🇳', digitCount: 10, format: 'XXXXX-XXXXX' },
  { name: 'Pakistan',             iso: 'PK', dialCode: '92',  flag: '🇵🇰', digitCount: 10, format: 'XXX-XXXXXXX' },
  { name: 'Bangladesh',           iso: 'BD', dialCode: '880', flag: '🇧🇩', digitCount: 10, format: 'XXXX-XXXXXX' },
  { name: 'China',                iso: 'CN', dialCode: '86',  flag: '🇨🇳', digitCount: 11, format: 'XXX XXXX XXXX' },
  { name: 'Japan',                iso: 'JP', dialCode: '81',  flag: '🇯🇵', digitCount: 10, format: 'XX-XXXX-XXXX' },
  { name: 'South Korea',          iso: 'KR', dialCode: '82',  flag: '🇰🇷', digitCount: 10, format: 'XX-XXXX-XXXX' },
  { name: 'Indonesia',            iso: 'ID', dialCode: '62',  flag: '🇮🇩', digitCount: 11, format: 'XXX-XXXX-XXXX' },
  { name: 'Philippines',          iso: 'PH', dialCode: '63',  flag: '🇵🇭', digitCount: 10, format: 'XXX XXX XXXX' },
  { name: 'Vietnam',              iso: 'VN', dialCode: '84',  flag: '🇻🇳', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Thailand',             iso: 'TH', dialCode: '66',  flag: '🇹🇭', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Singapore',            iso: 'SG', dialCode: '65',  flag: '🇸🇬', digitCount: 8,  format: 'XXXX XXXX' },
  { name: 'Malaysia',             iso: 'MY', dialCode: '60',  flag: '🇲🇾', digitCount: 9,  format: 'XX-XXXXXXX' },
  { name: 'New Zealand',          iso: 'NZ', dialCode: '64',  flag: '🇳🇿', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'South Africa',         iso: 'ZA', dialCode: '27',  flag: '🇿🇦', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Nigeria',              iso: 'NG', dialCode: '234', flag: '🇳🇬', digitCount: 10, format: 'XXX XXX XXXX' },
  { name: 'Kenya',                iso: 'KE', dialCode: '254', flag: '🇰🇪', digitCount: 9,  format: 'XXX XXX XXX' },
  { name: 'Ghana',                iso: 'GH', dialCode: '233', flag: '🇬🇭', digitCount: 9,  format: 'XX XXX XXXX' },
  { name: 'Egypt',                iso: 'EG', dialCode: '20',  flag: '🇪🇬', digitCount: 10, format: 'XXX XXXXXXX' },
  { name: 'Morocco',              iso: 'MA', dialCode: '212', flag: '🇲🇦', digitCount: 9,  format: 'XX-XXX-XXXX' },
  { name: 'Brazil',               iso: 'BR', dialCode: '55',  flag: '🇧🇷', digitCount: 11, format: 'XX XXXXX-XXXX' },
  { name: 'Mexico',               iso: 'MX', dialCode: '52',  flag: '🇲🇽', digitCount: 10, format: 'XXX XXX XXXX' },
  { name: 'Argentina',            iso: 'AR', dialCode: '54',  flag: '🇦🇷', digitCount: 10, format: 'XXX XXX-XXXX' },
  { name: 'Colombia',             iso: 'CO', dialCode: '57',  flag: '🇨🇴', digitCount: 10, format: 'XXX XXX XXXX' },
  { name: 'Chile',                iso: 'CL', dialCode: '56',  flag: '🇨🇱', digitCount: 9,  format: 'X XXXX XXXX' },
  { name: 'Peru',                 iso: 'PE', dialCode: '51',  flag: '🇵🇪', digitCount: 9,  format: 'XXX XXX XXX' },
];

/**
 * Normalizes raw phone input to just the local digits (strips country code prefix
 * and all non-digit characters).
 */
export function normalizePhoneDigits(raw: string, countryIso: string): string {
  const country = COUNTRIES.find(c => c.iso === countryIso);
  let digits = raw.replace(/\D/g, '');
  // Strip leading country dial code if the user included it
  if (country && digits.startsWith(country.dialCode) && digits.length > country.digitCount) {
    digits = digits.slice(country.dialCode.length);
  }
  return digits.slice(0, country?.digitCount ?? 15);
}

/**
 * Formats local digits into the country's display pattern.
 * e.g. "2345678910" + "US" → "234-567-8910"
 */
export function formatPhoneLocal(digits: string, countryIso: string): string {
  const country = COUNTRIES.find(c => c.iso === countryIso);
  if (!country || !digits) return digits;
  const capped = digits.slice(0, country.digitCount);
  let result = '';
  let di = 0;
  for (const char of country.format) {
    if (di >= capped.length) break;
    if (char === 'X') {
      result += capped[di++];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Returns the full international display string.
 * e.g. "2345678910" + "US" → "+1 234-567-8910"
 */
export function getFullPhoneDisplay(digits: string, countryIso: string): string {
  const country = COUNTRIES.find(c => c.iso === countryIso);
  if (!country || !digits) return '';
  return `+${country.dialCode} ${formatPhoneLocal(digits, countryIso)}`;
}

/**
 * Validates local phone digits against the expected digit count for the country.
 */
export function getPhoneErrorForCountry(digits: string, countryIso: string): string | null {
  const country = COUNTRIES.find(c => c.iso === countryIso);
  if (!country) return 'Please select a valid country.';
  if (!digits) return 'Phone number is required.';
  if (digits.length !== country.digitCount) {
    return `Please enter a valid ${country.name} phone number (${country.digitCount} digits).`;
  }
  return null;
}

// Enhanced email validation with typo detection and suggestion
export function getEmailError(email: string): string | { message: string; suggestion: string } | null {
  if (!email) return 'Email is required.';
  
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.';
  }

  // Check for common typos
  const domain = email.split('@')[1]?.toLowerCase() || '';
  for (const [typo, correct] of Object.entries(COMMON_EMAIL_TYPOS)) {
    if (domain === typo) {
      const suggestion = `${email.split('@')[0]}@${correct}`;
      return { message: `Did you mean ${suggestion}?`, suggestion };
    }
  }

  return null;
}

export function getPhoneError(phone: string): string | null {
  if (!phone) return 'Phone number is required.';
  if (!isValidUSPhone(phone)) return 'Please enter a valid US phone number.';
  return null;
} 