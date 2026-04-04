import { LeagueApiService } from './admin';

export * from '@salem/types';
export * from './admin';
export * from './public';

export const leagueApi = new LeagueApiService();
