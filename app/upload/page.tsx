"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

export default function UploadPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [authError, setAuthError] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Read file as data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string)
      setUploadSuccess(false)
      setAuthError(false)
    }
    reader.readAsDataURL(file)
  }

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please drop an image file")
      return
    }

    // Read file as data URL
    const reader = new FileReader()
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string)
      setUploadSuccess(false)
      setAuthError(false)
    }
    reader.readAsDataURL(file)
  }

  // Prevent default drag behavior
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // Handle authentication error
  const handleAuthError = () => {
    setAuthError(true)
    // Automatically redirect to sign-in after 3 seconds
    setTimeout(() => {
      signIn("google", { callbackUrl: window.location.href })
    }, 3000)
  }

  // Manual sign-in redirect
  const handleSignIn = () => {
    signIn("google", { callbackUrl: window.location.href })
  }

  // Upload image
  const uploadImage = async () => {
    if (!selectedImage) return

    setUploading(true)
    setAuthError(false)

    try {
      const response = await fetch("/api/main-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData: selectedImage }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401 || data.requiresAuth) {
          handleAuthError()
          return
        }
        throw new Error(data.error || "Failed to upload image")
      }

      setUploadSuccess(true)
    } catch (error) {
      console.error("Error uploading image:", error)

      // Check if the error message indicates authentication failure
      if (
        error instanceof Error &&
        (error.message.includes("Authentication failed") || error.message.includes("sign in again"))
      ) {
        handleAuthError()
        return
      }

      alert("Error uploading image. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Upload Main Image</h1>

      <div className="mb-4">
        <Link href="/">
          <Button variant="outline">Back to Mosaic</Button>
        </Link>
      </div>

      {/* Authentication Error Alert */}
      {authError && (
        <Alert className="mb-4 border-red-500 bg-red-50">
          <AlertDescription className="text-red-700">
            <div className="flex items-center justify-between">
              <div>
                <strong>Session Expired</strong>
                <p className="mt-1">Your session has expired. Redirecting to sign-in page in 3 seconds...</p>
              </div>
              <Button onClick={handleSignIn} variant="outline" size="sm" className="ml-4">
                Sign In Now
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent className="p-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {selectedImage ? (
              <img src={selectedImage || "/placeholder.svg"} alt="Selected" className="max-h-96 mx-auto" />
            ) : (
              <div className="py-12">
                <p className="text-gray-500">Click or drag and drop an image here</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={uploadImage} disabled={!selectedImage || uploading || authError} className="w-48">
          {uploading ? "Uploading..." : "Set as Main Image"}
        </Button>
      </div>

      {uploadSuccess && <div className="mt-4 text-center text-green-600">Image uploaded successfully!</div>}
    </div>
  )
}
