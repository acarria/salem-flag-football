import { BaseApiService } from '../core/base';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  recaptcha_token: string;
}

class ContactApiService extends BaseApiService {
  async submitContactForm(payload: ContactPayload): Promise<void> {
    await this.request<void>('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

const contactApi = new ContactApiService();
export const submitContactForm = contactApi.submitContactForm.bind(contactApi);
