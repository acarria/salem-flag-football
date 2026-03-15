import { z } from 'zod';

export const PlayerProfileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  registrationDate: z.string().optional().nullable(),
  paymentStatus: z.string().optional().nullable(),
  waiverStatus: z.string().optional().nullable(),
});

export const SoloRegistrationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  registration: z.object({
    id: z.string().uuid(),
    league_id: z.string().uuid(),
    registration_status: z.string(),
  }).optional(),
});

export const PublicLeagueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  is_active: z.boolean(),
  is_registration_open: z.boolean(),
  registered_players_count: z.number(),
  player_cap: z.number().nullable(),
  spots_remaining: z.number().nullable(),
});

export const PublicLeaguesSchema = z.array(PublicLeagueSchema);
