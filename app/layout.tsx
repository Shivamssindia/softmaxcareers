import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ModalProvider } from "@/context/ModalContext";
import { JobProvider } from "@/context/JobContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StructuredData } from "@/components/StructuredData";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://softmax.in"),
  title: {
    default: "SoftMax IT Careers Platform | Tech & Non-Tech IT Jobs",
    template: "%s | SoftMax IT Careers Platform",
  },
  description:
    "Official IT Careers Platform for SoftMax (softmax.in). Top destination for careers across AI development, distributed system design, cloud DevOps, and non-tech IT leadership. Apply online and track your applications live.",
  keywords: [
    "IT jobs",
    "jobs in IT field",
    "tech and non tech IT jobs",
    "softmax.in",
    "SoftMax career platform",
    "AI engineering jobs",
    "AI development",
    "system designing",
    "software development",
    "full stack developer jobs",
    "distributed systems architect",
    "cloud devops engineer jobs",
    "IT project manager jobs",
    "IT business analyst jobs",
    "IT recruitment and talent acquisition",
    "enterprise software development",
    "candidate tracking console",
    "IT careers India",
    "remote IT jobs",
  ],
  authors: [{ name: "SoftMax Technologies", url: "https://softmax.in" }],
  creator: "SoftMax Technologies",
  publisher: "SoftMax Technologies",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
  alternates: {
    canonical: "https://softmax.in",
  },
  openGraph: {
    title: "SoftMax IT Careers Platform | Tech & Non-Tech IT Jobs",
    description:
      "Explore premier tech and non-tech IT careers, cutting-edge AI development, distributed systems architecture, and live candidate tracking at SoftMax (softmax.in).",
    url: "https://softmax.in",
    siteName: "SoftMax IT Careers Platform",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "SoftMax IT Careers Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SoftMax IT Careers Platform | Tech & Non-Tech IT Jobs",
    description:
      "Find top IT jobs in tech & non-tech fields. Track your application live with SoftMax Candidate Console.",
    creator: "@softmax_tech",
    images: ["https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light scroll-smooth" suppressHydrationWarning>
      <head>
        <StructuredData />
        <script id="google-identity-services" src="https://accounts.google.com/gsi/client" async defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('softmax_spatial_theme') || 'light';
                if (storedTheme === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                }
                document.documentElement.setAttribute('data-theme', storedTheme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-[#0b0f19] selection:bg-indigo-600 selection:text-white antialiased transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <ModalProvider>
              <JobProvider>
                <Header />
                <main className="flex-grow">{children}</main>
                <Footer />
              </JobProvider>
            </ModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
