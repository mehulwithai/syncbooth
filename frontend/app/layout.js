import './globals.css';
import Footer from '../components/Footer';

export const metadata = {
  title: 'SyncBooth — Photobooth for Long Distance Couples',
  description: 'Take a synced photo together, wherever you both are.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col min-h-screen bg-[#0f0a1a]">
          <div className="flex-1 flex flex-col w-full">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}

