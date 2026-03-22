import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salem Flag Football League',
  description: 'Community flag football in historic Salem, Massachusetts.',
  openGraph: {
    title: 'Salem Flag Football League',
    description: 'Community flag football in historic Salem, Massachusetts.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
