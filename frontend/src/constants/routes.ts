// Application routes
export const ROUTES = {
  HOME: '/',
  PROFILE: '/profile',
  ADMIN: '/admin',
  TEST: '/test',
} as const;

// API routes
export const API_ROUTES = {
  // User routes
  USER_PROFILE: '/user/profile',
  
  // League routes
  LEAGUE_STANDINGS: '/league/standings',
  LEAGUE_SCHEDULE: '/league/schedule',
  LEAGUE_ACTIVE: '/league/active',
  LEAGUE_INFO: '/league/info',
  LEAGUE_RULES: '/league/rules',
  
  // Admin routes
  ADMIN_LEAGUES: '/admin/leagues',
  ADMIN_ADMINS: '/admin/admins',
} as const; 