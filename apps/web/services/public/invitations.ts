import { BaseApiService } from '../core/base';
import { MyGroup } from '@salem/types';

export interface InvitationDetail {
  group_id: string;
  group_name: string;
  league_id: string;
  league_name: string;
  inviter_name: string;
  invitee_first_name: string;
  invitee_last_name: string;
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

export interface SuccessResponse {
  success: boolean;
  message: string;
}

class InvitationApiService extends BaseApiService {
  private authHeaders(authToken: string): HeadersInit {
    return { Authorization: `Bearer ${authToken}` };
  }

  async getInvitation(token: string): Promise<InvitationDetail> {
    return this.request<InvitationDetail>(`/registration/invite/${token}`);
  }

  async acceptInvitation(token: string, authToken: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/registration/invite/${token}/accept`, {
      method: 'POST',
      headers: this.authHeaders(authToken),
    });
  }

  async declineInvitation(token: string, authToken: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/registration/invite/${token}/decline`, {
      method: 'POST',
      headers: this.authHeaders(authToken),
    });
  }

  async getPendingInvitations(authToken: string): Promise<PendingInvitation[]> {
    return this.request<PendingInvitation[]>('/registration/invitations/me', {
      headers: this.authHeaders(authToken),
    });
  }

  async getMyGroups(authToken: string): Promise<MyGroup[]> {
    return this.request<MyGroup[]>('/registration/groups/mine', {
      headers: this.authHeaders(authToken),
    });
  }

  async revokeInvitation(invitationId: string, authToken: string): Promise<SuccessResponse> {
    return this.request<SuccessResponse>(`/registration/groups/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: this.authHeaders(authToken),
    });
  }
}

export const invitationService = new InvitationApiService();
