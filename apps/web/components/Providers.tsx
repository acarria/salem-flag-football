'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import AppShell from './AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}>
        <AppShell>{children}</AppShell>
      </GoogleReCaptchaProvider>
    </ClerkProvider>
  );
}
