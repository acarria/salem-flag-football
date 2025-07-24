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