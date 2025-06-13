"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignIn() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams?.get("callbackUrl") || "/"

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Sign in to access the Mosaic App</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            You need to sign in with Google to use the Mosaic App. This allows us to store your photos in your Google
            Drive.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => signIn("google", { callbackUrl })}>
            Sign in with Google
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
