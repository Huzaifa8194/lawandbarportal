import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "@cyntler/react-doc-viewer/dist/index.css";
import { AuthProvider } from "./context/auth-context";
import RegisterSW from "./components/register-sw";
import InstallPrompt from "./components/install-prompt";

const siteTitle = "Law & Bar";
const siteDescription =
  "Private study portal — sign in to access your materials.";

function metadataBase(): URL | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      /* ignore invalid env */
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return undefined;
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#121f1d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: siteTitle, template: `%s · ${siteTitle}` },
  description: siteDescription,
  applicationName: siteTitle,
  generator: null,
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteTitle,
  },
  openGraph: {
    type: "website",
    title: siteTitle,
    description: siteDescription,
    siteName: siteTitle,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="apple-touch-icon"
          href="/web-app-manifest-192x192.png"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <RegisterSW />
        <AuthProvider>
          {children}
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
