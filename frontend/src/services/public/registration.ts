import { BaseApiService } from '../core/base';
import { RegistrationData } from '../core/types';

export class RegistrationApiService extends BaseApiService {
  async registerPlayer(registrationData: RegistrationData): Promise<any> {
    return this.request<any>('/registration/player', {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }

  async registerGroup(registrationData: RegistrationData): Promise<any> {
    return this.request<any>('/registration/group', {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }
}
