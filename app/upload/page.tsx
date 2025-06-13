"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function UploadPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    }
    reader.readAsDataURL(file)
  }

  // Prevent default drag behavior
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // Upload image
  const uploadImage = async () => {
    if (!selectedImage) return

    setUploading(true)

    try {
      const response = await fetch("/api/main-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData: selectedImage }),
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      setUploadSuccess(true)
    } catch (error) {
      console.error("Error uploading image:", error)
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
        <Button onClick={uploadImage} disabled={!selectedImage || uploading} className="w-48">
          {uploading ? "Uploading..." : "Set as Main Image"}
        </Button>
      </div>

      {uploadSuccess && <div className="mt-4 text-center text-green-600">Image uploaded successfully!</div>}
    </div>
  )
}
