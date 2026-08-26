import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Lora } from "next/font/google";
import { ArtifactProvider } from "@/contexts/ArtifactContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AudioProvider } from "@/contexts/AudioContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cogito",
  description:
    "An AI chat app with a familiar interface, powered by your own API.",
  icons: {
    icon: [
      { url: "/CogitoIcon-transparant.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/CogitoIcon-transparant.png",
    apple: "/apple-icon.png",
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${lora.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ArtifactProvider>
            <AudioProvider>
              {children}
            </AudioProvider>
          </ArtifactProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
