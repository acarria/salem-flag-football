// Import services first
import { LeagueApiService, AdminApiService, TeamApiService } from './admin';
import { UserApiService, RegistrationApiService } from './public';

// Export all types
export * from './core';

// Export all API services
export * from './admin';
export * from './public';

export const leagueApi = new LeagueApiService();
export const adminApi = new AdminApiService();
export const userApi = new UserApiService();
export const registrationApi = new RegistrationApiService();
export const teamApi = new TeamApiService();

// Legacy compatibility - create a combined service for backward compatibility
class CombinedApiService {
  // League methods
  getStandings = leagueApi.getStandings.bind(leagueApi);
  getSchedule = leagueApi.getSchedule.bind(leagueApi);
  getActiveLeagues = leagueApi.getActiveLeagues.bind(leagueApi);
  getPublicLeagues = leagueApi.getPublicLeagues.bind(leagueApi);
  getLeagueInfo = leagueApi.getLeagueInfo.bind(leagueApi);
  getLeagueRules = leagueApi.getLeagueRules.bind(leagueApi);
  createLeague = leagueApi.createLeague.bind(leagueApi);
  getAllLeagues = leagueApi.getAllLeagues.bind(leagueApi);
  getLeagueDetails = leagueApi.getLeagueDetails.bind(leagueApi);
  updateLeague = leagueApi.updateLeague.bind(leagueApi);
  deleteLeague = leagueApi.deleteLeague.bind(leagueApi);
  getLeagueStats = leagueApi.getLeagueStats.bind(leagueApi);

  // Admin methods
  getAdminConfigs = adminApi.getAdminConfigs.bind(adminApi);
  addAdminEmail = adminApi.addAdminEmail.bind(adminApi);
  updateAdminConfig = adminApi.updateAdminConfig.bind(adminApi);
  removeAdminEmail = adminApi.removeAdminEmail.bind(adminApi);
  getAllUsers = adminApi.getAllUsers.bind(adminApi);
  generateTeams = adminApi.generateTeams.bind(adminApi);
  generateScheduleForLeague = adminApi.generateScheduleForLeague.bind(adminApi);
  getLeagueSchedule = adminApi.getLeagueSchedule.bind(adminApi);
  getLeagueMembers = adminApi.getLeagueMembers.bind(adminApi);
  addFakeData = adminApi.addFakeData.bind(adminApi);
  getAdminDashboard = adminApi.getAdminDashboard.bind(adminApi);
  generateSchedule = adminApi.generateSchedule.bind(adminApi);
  randomizeTeams = adminApi.randomizeTeams.bind(adminApi);

  // User methods
  getUserProfile = userApi.getUserProfile.bind(userApi);
  updateUserProfile = userApi.updateUserProfile.bind(userApi);
  checkLeagueRegistration = userApi.checkLeagueRegistration.bind(userApi);

  // Registration methods
  registerPlayer = registrationApi.registerPlayer.bind(registrationApi);
  registerGroup = registrationApi.registerGroup.bind(registrationApi);

  // Team methods
  getTeams = teamApi.getTeams.bind(teamApi);
  getTeam = teamApi.getTeam.bind(teamApi);
}

// Export the combined service for backward compatibility
export const apiService = new CombinedApiService();
export { CombinedApiService };
export default apiService;
