import type { Metadata } from "next";
import { Sansation } from "next/font/google";
import "./globals.css";

const sansation = Sansation({
  variable: "--font-sansation",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "SGAP · Cofre Express",
  description: "Sistema de Gestión de Almacenamiento de Paquetes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${sansation.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
