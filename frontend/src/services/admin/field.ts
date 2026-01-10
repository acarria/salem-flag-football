import { BaseApiService } from '../core/base';
import { Field, FieldCreateRequest, FieldUpdateRequest } from '../core/types';

export class FieldApiService extends BaseApiService {
  // Global field management (fields are independent of leagues)
  async getAllFields(isActive?: boolean): Promise<Field[]> {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    return this.request<Field[]>(`/admin/fields${params}`);
  }

  async getField(fieldId: number): Promise<Field> {
    return this.request<Field>(`/admin/fields/${fieldId}`);
  }

  async createField(fieldData: FieldCreateRequest): Promise<Field> {
    return this.request<Field>(`/admin/fields`, {
      method: 'POST',
      body: JSON.stringify(fieldData),
    });
  }

  async updateField(fieldId: number, fieldData: FieldUpdateRequest): Promise<Field> {
    return this.request<Field>(`/admin/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(fieldData),
    });
  }

  async deleteField(fieldId: number): Promise<void> {
    return this.request<void>(`/admin/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }

  // League-field association endpoints
  async getFieldsForLeague(leagueId: number, isActive?: boolean): Promise<Field[]> {
    const params = isActive !== undefined ? `?is_active=${isActive}` : '';
    return this.request<Field[]>(`/admin/leagues/${leagueId}/fields${params}`);
  }

  async associateFieldWithLeague(leagueId: number, fieldId: number): Promise<void> {
    return this.request<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
      method: 'POST',
    });
  }

  async disassociateFieldFromLeague(leagueId: number, fieldId: number): Promise<void> {
    return this.request<void>(`/admin/leagues/${leagueId}/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }
}

