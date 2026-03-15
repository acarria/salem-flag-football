import { BaseApiService } from '../core/base';
import { MyGroup } from '../core/types';

export interface InvitationDetail {
  token: string;
  group_id: string;
  group_name: string;
  league_id: string;
  league_name: string;
  inviter_name: string;
  invitee_first_name: string;
  invitee_last_name: string;
  invitee_email: string;
  status: string;
  expires_at: string;
}

export interface PendingInvitation {
  token: string;
  group_name: string;
  league_name: string;
  inviter_name: string;
  expires_at: string;
}

class InvitationApiService extends BaseApiService {
  async getInvitation(token: string): Promise<InvitationDetail> {
    return this.request<InvitationDetail>(`/registration/invite/${token}`);
  }

  async acceptInvitation(token: string, authToken: string): Promise<any> {
    return this.request<any>(`/registration/invite/${token}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  async declineInvitation(token: string): Promise<any> {
    return this.request<any>(`/registration/invite/${token}/decline`, {
      method: 'POST',
    });
  }

  async getPendingInvitations(authToken: string): Promise<PendingInvitation[]> {
    return this.request<PendingInvitation[]>('/registration/invitations/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  async getMyGroups(authToken: string): Promise<MyGroup[]> {
    return this.request<MyGroup[]>('/registration/groups/mine', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  async revokeInvitation(invitationId: string, authToken: string): Promise<any> {
    return this.request<any>(`/registration/groups/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }
}

export const invitationService = new InvitationApiService();
