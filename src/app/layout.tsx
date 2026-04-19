import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { SettingsProvider } from '@/context/SettingsContext';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TwinMind – Live Meeting Copilot',
  description:
    'An always-on AI meeting copilot that listens to your conversations and surfaces real-time suggestions, fact-checks, and talking points powered by Groq.',
  keywords: ['AI meeting assistant', 'live transcription', 'meeting copilot', 'Groq', 'Whisper'],
  openGraph: {
    title: 'TwinMind – Live Meeting Copilot',
    description: 'Real-time suggestions and transcription for your meetings.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
