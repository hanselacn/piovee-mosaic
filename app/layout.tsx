import type React from "react"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { SessionProvider } from "@/components/session-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mosaic App",
  description: "Create beautiful photo mosaics",
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Try to get the session, but don't throw an error if it fails
  let session
  try {
    session = await getServerSession(authOptions)
  } catch (error) {
    console.error("Error getting session:", error)
    session = null
  }

  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}
