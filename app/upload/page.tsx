"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface GridPreview {
  cols: number
  rows: number
  tileSize: number
}

const TILE_SIZE = 30 // Match the tile size from page.tsx

export default function UploadPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [gridPreview, setGridPreview] = useState<GridPreview | null>(null)

  // Calculate grid preview when image is selected
  useEffect(() => {
    if (selectedImage && previewRef.current) {
      const img = new Image()
      img.src = selectedImage
      img.onload = () => {
        const { width, height } = img
        const aspectRatio = width / height

        // Calculate grid dimensions
        const cols = Math.floor(width / TILE_SIZE)
        const rows = Math.floor(height / TILE_SIZE)

        // Ensure minimum number of tiles
        const minTiles = 200
        let finalCols = cols
        let finalRows = rows

        if (cols * rows < minTiles) {
          const scale = Math.sqrt(minTiles / (cols * rows))
          finalCols = Math.floor(cols * scale)
          finalRows = Math.floor(rows * scale)
        }

        setGridPreview({
          cols: finalCols,
          rows: finalRows,
          tileSize: TILE_SIZE,
        })
      }
    }
  }, [selectedImage])

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
      setError("")
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
      setError("")
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
    setError("")

    try {
      console.log("📤 Uploading main image...")

      const response = await fetch("/api/main-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData: selectedImage }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image")
      }

      console.log("✅ Main image uploaded successfully:", data)
      setUploadSuccess(true)
    } catch (error) {
      console.error("❌ Error uploading image:", error)
      setError(error instanceof Error ? error.message : "Failed to upload image")
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

      {/* Error Alert */}
      {error && (
        <Alert className="mb-4 border-red-500 bg-red-50">
          <AlertDescription className="text-red-700">
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-4">
        <CardContent className="p-4">
          <div
            ref={previewRef}
            className="relative border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {selectedImage ? (
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="max-h-96 mx-auto relative z-10"
                />
                {gridPreview && (
                  <div className="absolute inset-0 z-20">
                    <div
                      className="grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${gridPreview.cols}, ${gridPreview.tileSize}px)`,
                        gridTemplateRows: `repeat(${gridPreview.rows}, ${gridPreview.tileSize}px)`,
                      }}
                    >
                      {Array.from({ length: gridPreview.cols * gridPreview.rows }).map((_, i) => (
                        <div
                          key={i}
                          className="border border-white/20 transition-opacity duration-300 hover:bg-white/10"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12">
                <p className="text-gray-500">Click or drag and drop an image here</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          {gridPreview && selectedImage && (
            <div className="mt-4 text-sm text-gray-500 text-center">
              Grid Preview: {gridPreview.cols} × {gridPreview.rows} tiles (
              {gridPreview.tileSize}px each)
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={uploadImage} disabled={!selectedImage || uploading} className="w-48">
          {uploading ? "Uploading..." : "Set as Main Image"}
        </Button>
      </div>

      {uploadSuccess && (
        <div className="mt-4 text-center text-green-600">
          <strong>✅ Image uploaded successfully!</strong>
          <p className="text-sm mt-1">You can now go back to the mosaic to see your image.</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-bold mb-2 text-blue-800">Upload Instructions:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Select or drag and drop an image file</li>
          <li>• White grid overlay shows how your image will be divided into tiles</li>
          <li>• Each tile will be replaced with a camera photo in the mosaic</li>
          <li>• The image will be uploaded to Google Drive using the service account</li>
          <li>• No sign-in required - uses automatic authentication</li>
          <li>• Camera photos will enhance your main image with the soft-light effect</li>
        </ul>
      </div>
    </div>
  )
}
