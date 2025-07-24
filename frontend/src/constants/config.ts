// Application configuration
export const CONFIG = {
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  ADMIN_EMAIL: 'alexcarria1@gmail.com', // This should come from environment variables
  APP_NAME: 'Salem Flag Football',
  VERSION: '1.0.0',
} as const;

// Game formats
export const GAME_FORMATS = {
  SEVEN_V_SEVEN: '7v7',
  FIVE_V_FIVE: '5v5',
  FOUR_V_FOUR: '4v4',
  THREE_V_THREE: '3v3',
} as const;

// Tournament formats
export const TOURNAMENT_FORMATS = {
  ROUND_ROBIN: 'round_robin',
  SWISS: 'swiss',
  PLAYOFF_BRACKET: 'playoff_bracket',
  COMPASS_DRAW: 'compass_draw',
} as const;

// Registration statuses
export const REGISTRATION_STATUSES = {
  REGISTERED: 'registered',
  PENDING: 'pending',
  NOT_REGISTERED: 'not_registered',
} as const;

// Payment statuses
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
} as const;

// Waiver statuses
export const WAIVER_STATUSES = {
  PENDING: 'pending',
  SIGNED: 'signed',
  EXPIRED: 'expired',
} as const; 