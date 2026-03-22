'use client';

import { useState } from 'react';
import { League, LeagueCreateRequest, LeagueUpdateRequest, LeagueStats, leagueApi } from '@/services';
import { logger } from '@/utils/logger';

export const useLeagues = () => {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadLeagues = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaguesData = await leagueApi.getAllLeagues();
      setLeagues(leaguesData);
    } catch (err) {
      logger.error('Failed to load leagues:', err);
      setError('Failed to load leagues. Please check your authentication and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeagueStats = async (leagueId: string) => {
    try {
      const stats = await leagueApi.getLeagueStats(leagueId);
      setLeagueStats(stats);
    } catch (err) {
      logger.error('Failed to load league stats:', err);
    }
  };

  const createLeague = async (leagueData: LeagueCreateRequest) => {
    try {
      await leagueApi.createLeague(leagueData);
      setSuccess('League created successfully!');
      await loadLeagues();
    } catch (err) {
      logger.error('Failed to create league:', err);
      setError('Failed to create league. Please try again.');
      throw err;
    }
  };

  const updateLeague = async (leagueId: string, leagueData: LeagueUpdateRequest) => {
    try {
      await leagueApi.updateLeague(leagueId, leagueData);
      setSuccess('League updated successfully!');
      await loadLeagues();
    } catch (err) {
      logger.error('Failed to update league:', err);
      setError('Failed to update league. Please try again.');
      throw err;
    }
  };

  const deleteLeague = async (leagueId: string) => {
    if (!window.confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
      return;
    }

    try {
      await leagueApi.deleteLeague(leagueId);
      setSuccess('League deleted successfully!');
      await loadLeagues();
    } catch (err) {
      logger.error('Failed to delete league:', err);
      setError('Failed to delete league. Please try again.');
      throw err;
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return {
    leagues,
    selectedLeague,
    setSelectedLeague,
    leagueStats,
    isLoading,
    error,
    success,
    loadLeagues,
    loadLeagueStats,
    createLeague,
    updateLeague,
    deleteLeague,
    clearMessages,
  };
};
