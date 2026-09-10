import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CBDEVS — Internal",
  description: "CBDEVS internal management dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
