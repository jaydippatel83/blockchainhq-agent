import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlockchainHQ Agent",
  description: "AI agent powered by BlockchainHQ for onchain interactions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen" suppressHydrationWarning>
        <header className="py-4 sm:py-6 flex items-center justify-between relative border-b border-indigo-500/30 backdrop-blur-sm">
          <div className="ml-4 sm:ml-6 text-xl sm:text-2xl font-bold">
            <span className="gradient-text-orange-pink">Blockchain</span>
            <span className="gradient-text-green-blue">HQ</span>
          </div>

          <span className="absolute left-1/2 transform -translate-x-1/2 text-2xl sm:text-3xl font-bold gradient-text-green-blue">
            Agent
          </span>
        </header>

        <main className="flex-grow flex items-center justify-center px-4">{children}</main>

        <footer className="py-4 sm:py-6 text-center flex-none border-t border-indigo-500/30 backdrop-blur-sm">
          <div className="text-base sm:text-lg font-semibold mb-3">
            <span className="gradient-text-orange-pink">Blockchain</span>
            <span className="gradient-text-green-blue">HQ</span>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:gap-4 px-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 gradient-button-purple-blue text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 font-medium text-sm sm:text-base"
            >
              GitHub
            </a>
            <a
              href="https://blockchainhq.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 gradient-button-purple-blue text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 font-medium text-sm sm:text-base"
            >
              Documentation
            </a>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 sm:px-4 py-2 gradient-button-purple-blue text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 font-medium text-sm sm:text-base"
            >
              Discord
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            © {currentYear} BlockchainHQ, Inc.
          </p>
        </footer>
      </body>
    </html>
  );
}
  