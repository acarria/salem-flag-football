import { LeagueApiService } from './admin';

export * from '@salem/types';
export * from './admin';
export * from './public';

export const leagueApi = new LeagueApiService();

class CombinedApiService {
  getLeagueStandings = leagueApi.getLeagueStandings.bind(leagueApi);
  getLeaguePublicSchedule = leagueApi.getLeaguePublicSchedule.bind(leagueApi);
  getPublicLeagues = leagueApi.getPublicLeagues.bind(leagueApi);
}

export const apiService = new CombinedApiService();
export { CombinedApiService };
export default apiService;
