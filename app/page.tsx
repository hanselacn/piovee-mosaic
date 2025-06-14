"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import Link from "next/link"
import { signIn } from "next-auth/react"

interface PhotoData {
  photoData: string
  timestamp: number
  id: string
  fileName?: string
}

export default function Home() {
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [tileSize, setTileSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>("")

  // New polling states
  const [autoPolling, setAutoPolling] = useState(true)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastPhotoCheck, setLastPhotoCheck] = useState<Date>(new Date())
  const [photoCheckStatus, setPhotoCheckStatus] = useState<string>("Ready")

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

  // Get main image
  const fetchMainImage = async () => {
    try {
      console.log("🖼️ Fetching main image...")
      const mainImageResponse = await fetch("/api/main-image")

      if (mainImageResponse.ok) {
        const mainImageData = await mainImageResponse.json()
        console.log("✅ Main image response:", mainImageData)

        const imageDataUrl = mainImageData.mainImage?.dataUrl
        console.log("🖼️ Image data URL exists:", !!imageDataUrl)
        console.log("🖼️ Image data URL length:", imageDataUrl?.length || 0)

        setMainImage(imageDataUrl || null)
        console.log("✅ Main image state set:", !!imageDataUrl)
      } else {
        console.error("❌ Main image fetch failed:", mainImageResponse.status, mainImageResponse.statusText)

        if (mainImageResponse.status === 401) {
          const errorData = await mainImageResponse.json()
          console.error("Auth error details:", errorData)
          if (errorData.requiresAuth) {
            handleAuthError()
            return
          }
        }
      }
      setAuthError(false)
    } catch (error) {
      console.error("❌ Error fetching main image:", error)
    }
  }

  // Get camera photos from Google Drive with duplicate detection
  const fetchCameraPhotos = async (showStatus = false) => {
    try {
      if (showStatus) {
        setPhotoCheckStatus("Checking for new photos...")
      }

      console.log("📸 Fetching camera photos...")
      const response = await fetch("/api/camera-photos")

      if (response.ok) {
        const data = await response.json()
        const newPhotos = data.photos || []

        console.log(`📷 Found ${newPhotos.length} photos in Google Drive`)
        console.log("Photo structure sample:", newPhotos[0])

        // Ensure photos have required structure
        const formattedPhotos = newPhotos.map((photo: any) => ({
          id: photo.id || photo.fileName || `photo-${Date.now()}-${Math.random()}`,
          photoData: photo.dataUrl || photo.photoData,
          timestamp: photo.timestamp || Date.now(),
          fileName: photo.fileName || photo.name,
        }))

        // Check for new photos by comparing IDs
        const existingIds = new Set(photos.map((p) => p.id))
        const actuallyNewPhotos = formattedPhotos.filter((photo: PhotoData) => !existingIds.has(photo.id))

        if (actuallyNewPhotos.length > 0) {
          console.log(`✨ Found ${actuallyNewPhotos.length} new photos`)
          console.log(
            "New photos:",
            actuallyNewPhotos.map((p) => ({ id: p.id, fileName: p.fileName })),
          )

          setPhotos((prevPhotos) => {
            // Combine existing and new photos, sort by timestamp (newest first)
            const combined = [...prevPhotos, ...actuallyNewPhotos]
            return combined.sort((a, b) => b.timestamp - a.timestamp)
          })
          setLastUpdate(new Date())

          if (showStatus) {
            setPhotoCheckStatus(`✅ Found ${actuallyNewPhotos.length} new photos`)
          }
        } else {
          console.log("📷 No new photos found")
          if (showStatus) {
            setPhotoCheckStatus("✅ No new photos")
          }
        }

        setLastPhotoCheck(new Date())
      } else {
        console.error("❌ Failed to fetch camera photos:", response.status, response.statusText)
        const errorText = await response.text()
        console.error("Error details:", errorText)

        if (showStatus) {
          setPhotoCheckStatus("❌ Failed to check photos")
        }
      }
    } catch (error) {
      console.error("❌ Error fetching camera photos:", error)
      if (showStatus) {
        setPhotoCheckStatus("❌ Error checking photos")
      }
    }

    // Clear status after 3 seconds
    if (showStatus) {
      setTimeout(() => setPhotoCheckStatus("Ready"), 3000)
    }
  }

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchMainImage()
      await fetchCameraPhotos()
      setLoading(false)
    }
    loadData()
  }, [])

  // Auto-polling every 10 seconds
  useEffect(() => {
    if (autoPolling && !authError) {
      console.log("🔄 Starting auto-polling every 10 seconds")
      const interval = setInterval(() => {
        fetchCameraPhotos()
      }, 10000) // 10 seconds

      setPollingInterval(interval)

      return () => {
        console.log("⏹️ Stopping auto-polling")
        clearInterval(interval)
        setPollingInterval(null)
      }
    } else if (pollingInterval) {
      console.log("⏹️ Stopping auto-polling")
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
  }, [autoPolling, authError, photos]) // Include photos in dependency to detect changes

  // Draw mosaic when main image or photos change
  useEffect(() => {
    console.log("🎨 Mosaic effect triggered")
    console.log("🎨 Main image exists:", !!mainImage)
    console.log("🎨 Canvas ref exists:", !!canvasRef.current)
    console.log("🎨 Photos count:", photos.length)

    if (!mainImage) {
      console.log("🎨 Skipping mosaic draw - no main image")
      return
    }

    if (!canvasRef.current) {
      console.log("🎨 Skipping mosaic draw - no canvas")
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      console.error("❌ Could not get canvas context")
      return
    }

    console.log(`🎨 Starting mosaic draw with ${photos.length} photos`)

    // Load main image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      console.log("✅ Main image loaded for canvas, dimensions:", img.width, "x", img.height)

      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw main image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      console.log("✅ Main image drawn on canvas")

      // Calculate grid
      const cols = Math.floor(canvas.width / tileSize)
      const rows = Math.floor(canvas.height / tileSize)
      const actualTileWidth = canvas.width / cols
      const actualTileHeight = canvas.height / rows

      console.log(`📐 Grid: ${cols}x${rows}, tile size: ${actualTileWidth}x${actualTileHeight}`)

      // Draw grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
      ctx.lineWidth = 1

      for (let i = 0; i <= cols; i++) {
        ctx.beginPath()
        ctx.moveTo(i * actualTileWidth, 0)
        ctx.lineTo(i * actualTileWidth, canvas.height)
        ctx.stroke()
      }

      for (let i = 0; i <= rows; i++) {
        ctx.beginPath()
        ctx.moveTo(0, i * actualTileHeight)
        ctx.lineTo(canvas.width, i * actualTileHeight)
        ctx.stroke()
      }

      console.log("✅ Grid drawn on canvas")

      // Draw photos in grid cells
      photos.forEach((photo, index) => {
        if (index >= cols * rows) {
          console.log(`⚠️ Skipping photo ${index} - exceeds grid capacity`)
          return // Skip if we have more photos than grid cells
        }

        if (!photo.photoData) {
          console.error(`❌ Photo ${index} missing photoData:`, photo)
          return
        }

        const row = Math.floor(index / cols)
        const col = index % cols

        const photoImg = new Image()
        photoImg.crossOrigin = "anonymous"
        photoImg.onload = () => {
          const x = col * actualTileWidth
          const y = row * actualTileHeight

          console.log(`🖼️ Drawing photo ${index} at position (${col}, ${row})`)
          // Draw photo in grid cell
          ctx.drawImage(photoImg, x, y, actualTileWidth, actualTileHeight)
        }
        photoImg.onerror = (error) => {
          console.error(`❌ Failed to load photo ${index}:`, error)
        }
        photoImg.src = photo.photoData
      })
    }
    img.onerror = (error) => {
      console.error("❌ Failed to load main image for canvas:", error)
    }

    console.log("🎨 Setting main image src:", mainImage.substring(0, 50) + "...")
    img.src = mainImage
  }, [mainImage, photos, tileSize])

  // Save mosaic to Google Drive
  const saveMosaicToGoogleDrive = async () => {
    if (!canvasRef.current) {
      alert("No mosaic to save!")
      return
    }

    setIsSaving(true)
    setSaveStatus("Preparing mosaic...")

    try {
      // Get the canvas data
      const canvas = canvasRef.current
      const mosaicData = canvas.toDataURL("image/jpeg", 0.9)

      setSaveStatus("Uploading to Google Drive...")

      const response = await fetch("/api/save-mosaic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mosaicData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 401 || errorData.requiresAuth) {
          handleAuthError()
          return
        }
        throw new Error(`Server error (${response.status}): ${errorData.error || response.statusText}`)
      }

      const result = await response.json()
      console.log("✅ Mosaic saved successfully:", result)

      setSaveStatus("✅ Mosaic saved to Google Drive!")
      setTimeout(() => setSaveStatus(""), 3000)
    } catch (error) {
      console.error("❌ Error saving mosaic:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setSaveStatus(`❌ Failed: ${errorMessage}`)
      setTimeout(() => setSaveStatus(""), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle auto-polling
  const toggleAutoPolling = () => {
    setAutoPolling(!autoPolling)
  }

  // Manual refresh
  const handleManualRefresh = () => {
    fetchMainImage()
    fetchCameraPhotos(true) // Show status for manual refresh
  }

  // Clear all photos
  const clearPhotos = async () => {
    if (confirm("Clear all photos from the mosaic? This will delete camera photos from Google Drive.")) {
      // Clear local photos
      setPhotos([])

      // Clear camera photos from Google Drive
      try {
        const response = await fetch("/api/camera-photos", { method: "DELETE" })
        if (response.ok) {
          console.log("✅ Camera photos cleared from Google Drive")
        } else {
          console.error("Failed to clear camera photos")
        }
      } catch (error) {
        console.error("Error clearing camera photos:", error)
      }
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Mosaic Display</h1>

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

      {/* Save Status */}
      {saveStatus && (
        <div
          className={`mb-4 p-3 rounded ${
            saveStatus.includes("❌")
              ? "bg-red-100 border border-red-400 text-red-700"
              : saveStatus.includes("✅")
                ? "bg-green-100 border border-green-400 text-green-700"
                : "bg-blue-100 border border-blue-400 text-blue-700"
          }`}
        >
          <strong>Save Status:</strong> {saveStatus}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          {/* Auto-polling toggle */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${autoPolling ? "bg-green-500" : "bg-gray-500"}`}></div>
            <span>Auto-check: {autoPolling ? "ON" : "OFF"}</span>
            <Switch checked={autoPolling} onCheckedChange={toggleAutoPolling} className="ml-2" />
          </div>

          <span>Photos: {photos.length}</span>

          {/* Photo check status */}
          <span className="text-sm text-gray-600">Status: {photoCheckStatus}</span>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button onClick={handleManualRefresh} variant="outline" size="sm">
              🔄 Check Now
            </Button>
            <Button onClick={clearPhotos} variant="outline" size="sm">
              🗑️ Clear Photos
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/upload">
            <Button variant="outline">Upload Main Image</Button>
          </Link>
          <Link href="/camera">
            <Button>Open Camera</Button>
          </Link>
          <Button
            onClick={saveMosaicToGoogleDrive}
            disabled={isSaving || !mainImage}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? "💾 Saving..." : "💾 Save Mosaic"}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
            ) : mainImage ? (
              <canvas ref={canvasRef} className="border border-gray-300 max-w-full"></canvas>
            ) : (
              <div className="text-center p-8">
                <p className="mb-4">No main image uploaded yet.</p>
                <Link href="/upload">
                  <Button>Upload Main Image</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Tile Size: {tileSize}px</label>
        <input
          type="range"
          min="20"
          max="100"
          value={tileSize}
          onChange={(e) => setTileSize(Number.parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-bold mb-2 text-blue-800">How it works:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Upload a main image first</li>
          <li>• Open camera on any device (no sign-in needed)</li>
          <li>• Photos are automatically checked every 10 seconds from Google Drive</li>
          <li>• Toggle "Auto-check" to turn automatic checking on/off</li>
          <li>• Click "Check Now" to manually check for new photos</li>
          <li>• Click "Save Mosaic" to save the completed collage to Google Drive</li>
          <li>• Use "Clear Photos" to start over with a clean mosaic</li>
        </ul>
      </div>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Total Photos: {photos.length}</div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Last Update: {lastUpdate.toLocaleTimeString()}</div>
        <div>Last Photo Check: {lastPhotoCheck.toLocaleTimeString()}</div>
        <div>Auto-check: {autoPolling ? "ON (10s)" : "OFF"}</div>
        <div>Check Status: {photoCheckStatus}</div>
        <div>Auth Error: {authError ? "Yes" : "No"}</div>
        <div>Loading: {loading ? "Yes" : "No"}</div>
      </div>
    </div>
  )
}
