import { BaseApiService } from '../core/base';
import { Field, FieldCreateRequest, FieldUpdateRequest } from '../core/types';

export class FieldApiService extends BaseApiService {
  // Global field management (fields are independent of leagues)
  async getAllFields(isActive?: boolean): Promise<Field[]> {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    return this.request<Field[]>(`/admin/fields${params}`);
  }

  async getField(fieldId: string): Promise<Field> {
    return this.request<Field>(`/admin/fields/${fieldId}`);
  }

  async createField(fieldData: FieldCreateRequest): Promise<Field> {
    return this.request<Field>(`/admin/fields`, {
      method: 'POST',
      body: JSON.stringify(fieldData),
    });
  }

  async updateField(fieldId: string, fieldData: FieldUpdateRequest): Promise<Field> {
    return this.request<Field>(`/admin/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(fieldData),
    });
  }

  async deleteField(fieldId: string): Promise<void> {
    return this.request<void>(`/admin/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }

  // League-field association endpoints
  async getFieldsForLeague(leagueId: string, isActive?: boolean): Promise<Field[]> {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    return this.request<Field[]>(`/admin/leagues/${leagueId}/fields${params}`);
  }

  async associateFieldWithLeague(leagueId: string, fieldId: string): Promise<void> {
    return this.request<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
      method: 'POST',
    });
  }

  async disassociateFieldFromLeague(leagueId: string, fieldId: string): Promise<void> {
    return this.request<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }
}

