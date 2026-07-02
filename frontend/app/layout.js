import './globals.css';

export const metadata = {
  title: 'SyncBooth — Photobooth for Long Distance Couples',
  description: 'Take a synced photo together, wherever you both are.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
