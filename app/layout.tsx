import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VTX — Browser Workspace",
  description: "Browser-based virtual shell and file manager",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
