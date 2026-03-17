// Import services first
import { LeagueApiService } from './admin';

// Export all types
export * from './core';

// Export all API services
export * from './admin';
export * from './public';

export const leagueApi = new LeagueApiService();

// Legacy compatibility - combined service used by HomePage, LeaguesPage, RegistrationModal
class CombinedApiService {
  getLeagueStandings = leagueApi.getLeagueStandings.bind(leagueApi);
  getLeaguePublicSchedule = leagueApi.getLeaguePublicSchedule.bind(leagueApi);
  getPublicLeagues = leagueApi.getPublicLeagues.bind(leagueApi);
}

export const apiService = new CombinedApiService();
export { CombinedApiService };
export default apiService;
