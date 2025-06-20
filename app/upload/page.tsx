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
  totalTiles: number
}

export default function UploadPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string>("")
  const [tileSize, setTileSize] = useState(20)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gridPreview, setGridPreview] = useState<GridPreview | null>(null)
  // Calculate grid preview when image is selected or tile size changes
  useEffect(() => {
    if (selectedImage) {
      const img = new Image()
      img.src = selectedImage
      img.onload = () => {
        const { width, height } = img
        
        // Calculate container dimensions based on preview area
        const containerWidth = 600 // Fixed preview width
        const containerHeight = Math.round(containerWidth * (height / width))
        
        // Calculate grid dimensions using Math.ceil for full coverage
        const cols = Math.ceil(containerWidth / tileSize)
        const rows = Math.ceil(containerHeight / tileSize)
        const totalTiles = cols * rows

        setGridPreview({
          cols,
          rows,
          tileSize,
          totalTiles,
        })

        // Draw grid overlay on canvas
        if (canvasRef.current) {
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = containerWidth
            canvas.height = containerHeight
            
            // Clear canvas
            ctx.clearRect(0, 0, containerWidth, containerHeight)
            
            // Draw grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
            ctx.lineWidth = 1
            
            // Vertical lines
            for (let x = 0; x <= containerWidth; x += tileSize) {
              ctx.beginPath()
              ctx.moveTo(x, 0)
              ctx.lineTo(x, containerHeight)
              ctx.stroke()
            }
            
            // Horizontal lines
            for (let y = 0; y <= containerHeight; y += tileSize) {
              ctx.beginPath()
              ctx.moveTo(0, y)
              ctx.lineTo(containerWidth, y)
              ctx.stroke()
            }
          }
        }
      }
    }
  }, [selectedImage, tileSize])

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

  // Upload image with grid configuration
  const uploadImage = async () => {
    if (!selectedImage || !gridPreview) return

    setUploading(true)
    setError("")

    try {
      console.log("📤 Uploading main image with grid configuration...")

      // Save main image and grid configuration to Firestore
      const response = await fetch("/api/main-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageData: selectedImage,
          gridConfig: {
            cols: gridPreview.cols,
            rows: gridPreview.rows,
            tileSize: gridPreview.tileSize,
            totalTiles: gridPreview.totalTiles,
          }
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload image")
      }

      console.log("✅ Main image and grid config uploaded successfully:", data)
      setUploadSuccess(true)
    } catch (error) {
      console.error("❌ Error uploading image:", error)
      setError(error instanceof Error ? error.message : "Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
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

      {/* Success Alert */}
      {uploadSuccess && (
        <Alert className="mb-4 border-green-500 bg-green-50">
          <AlertDescription className="text-green-700">
            <strong>Success!</strong> Main image uploaded successfully!{" "}
            <Link href="/" className="underline">
              Go to Mosaic
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Upload Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Select Image</h2>
            <div
              className="relative border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer transition-colors hover:border-gray-400"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {selectedImage ? (
                <div className="relative w-full h-64 overflow-hidden rounded-md">
                  <img
                    src={selectedImage}
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                  {/* Grid overlay */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ mixBlendMode: 'overlay' }}
                  />
                </div>
              ) : (
                <div className="py-12">
                  <div className="text-4xl mb-4">📷</div>
                  <p className="text-gray-500 mb-2">Click or drag and drop an image here</p>
                  <p className="text-sm text-gray-400">Supports: JPG, PNG, GIF</p>
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
          </CardContent>
        </Card>

        {/* Grid Configuration Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Grid Configuration</h2>
            
            {selectedImage ? (
              <div className="space-y-4">
                {/* Tile Size Slider */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Tile Size: {tileSize}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={tileSize}
                    onChange={(e) => setTileSize(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10px (Fine)</span>
                    <span>50px (Coarse)</span>
                  </div>
                </div>

                {/* Grid Preview Stats */}
                {gridPreview && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Grid Preview</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Columns:</span>
                        <span className="font-mono ml-2">{gridPreview.cols}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Rows:</span>
                        <span className="font-mono ml-2">{gridPreview.rows}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Tiles:</span>
                        <span className="font-mono ml-2">{gridPreview.totalTiles}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tile Size:</span>
                        <span className="font-mono ml-2">{gridPreview.tileSize}px</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                <Button
                  onClick={uploadImage}
                  disabled={uploading || !gridPreview}
                  className="w-full"
                  size="lg"
                >
                  {uploading ? "Uploading..." : "Upload Image & Create Mosaic"}
                </Button>

                <div className="text-xs text-gray-500 text-center">
                  The grid overlay shows how photos will be arranged on your image
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">⚙️</div>
                <p className="text-gray-500">Select an image to configure the grid</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
