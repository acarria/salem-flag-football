const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  recaptcha_token: string;
}

export async function submitContactForm(payload: ContactPayload): Promise<void> {
  const res = await fetch(`${API_URL}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to send message. Please try again.');
  }
}
