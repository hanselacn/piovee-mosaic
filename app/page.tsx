"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { signIn } from "next-auth/react"

interface PhotoData {
  id: string
  name: string
  dataUrl: string
  timestamp: number
}

export default function Home() {
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [tileSize, setTileSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [syncStatus, setSyncStatus] = useState<string>("")

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

  // Sync temporary photos to Google Drive
  const syncPhotos = async () => {
    try {
      setSyncStatus("Syncing photos to Google Drive...")
      const response = await fetch("/api/sync-photos", {
        method: "POST",
      })

      if (response.ok) {
        const result = await response.json()
        if (result.synced > 0) {
          setSyncStatus(`✅ Synced ${result.synced} new photos!`)
          setTimeout(() => setSyncStatus(""), 3000)
        } else {
          setSyncStatus("")
        }
      } else if (response.status === 401) {
        const errorData = await response.json()
        if (errorData.requiresAuth) {
          handleAuthError()
          return
        }
      }
    } catch (error) {
      console.error("Error syncing photos:", error)
      setSyncStatus("❌ Failed to sync photos")
      setTimeout(() => setSyncStatus(""), 3000)
    }
  }

  // Get main image and photos
  const fetchData = async () => {
    try {
      // First sync any temporary photos to Google Drive
      await syncPhotos()

      // Get main image
      const mainImageResponse = await fetch("/api/main-image")
      if (mainImageResponse.ok) {
        const mainImageData = await mainImageResponse.json()
        setMainImage(mainImageData.mainImage?.dataUrl || null)
      } else if (mainImageResponse.status === 401) {
        const errorData = await mainImageResponse.json()
        if (errorData.requiresAuth) {
          handleAuthError()
          return
        }
      }

      // Get collage photos from Google Drive
      const photosResponse = await fetch("/api/collage-photos")
      if (photosResponse.ok) {
        const photosData = await photosResponse.json()
        setPhotos(photosData.photos || [])
      } else if (photosResponse.status === 401) {
        const errorData = await photosResponse.json()
        if (errorData.requiresAuth) {
          handleAuthError()
          return
        }
      }

      setAuthError(false)
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchData()
      setLoading(false)
    }
    loadData()
  }, [])

  // Controlled auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (autoRefresh && !authError) {
      const interval = setInterval(() => {
        fetchData()
      }, 5000) // 5 seconds

      setRefreshInterval(interval)

      return () => {
        clearInterval(interval)
        setRefreshInterval(null)
      }
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh, authError])

  // Draw mosaic when main image or photos change
  useEffect(() => {
    if (!mainImage || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Load main image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw main image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Calculate grid
      const cols = Math.floor(canvas.width / tileSize)
      const rows = Math.floor(canvas.height / tileSize)
      const actualTileWidth = canvas.width / cols
      const actualTileHeight = canvas.height / rows

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

      // Draw photos in grid cells
      photos.forEach((photo, index) => {
        if (index >= cols * rows) return // Skip if we have more photos than grid cells

        const row = Math.floor(index / cols)
        const col = index % cols

        const photoImg = new Image()
        photoImg.crossOrigin = "anonymous"
        photoImg.onload = () => {
          const x = col * actualTileWidth
          const y = row * actualTileHeight

          // Draw photo in grid cell
          ctx.drawImage(photoImg, x, y, actualTileWidth, actualTileHeight)
        }
        photoImg.src = photo.dataUrl
      })
    }
    img.src = mainImage
  }, [mainImage, photos, tileSize])

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  // Manual refresh
  const handleRefresh = () => {
    fetchData()
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

      {/* Sync Status */}
      {syncStatus && (
        <div
          className={`mb-4 p-3 rounded ${
            syncStatus.includes("❌")
              ? "bg-red-100 border border-red-400 text-red-700"
              : syncStatus.includes("✅")
                ? "bg-green-100 border border-green-400 text-green-700"
                : "bg-blue-100 border border-blue-400 text-blue-700"
          }`}
        >
          <strong>Sync Status:</strong> {syncStatus}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Google Drive Storage</span>
          </div>
          <span>Photos: {photos.length}</span>

          {/* Auto-refresh controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleAutoRefresh}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {autoRefresh ? "🔄 Auto-Refresh ON" : "⏸️ Auto-Refresh OFF"}
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              🔄 Refresh Now
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
          <li>• Photos are stored temporarily, then synced to Google Drive</li>
          <li>• Click "Auto-Refresh ON" to automatically sync and check for new photos every 5 seconds</li>
          <li>• Use "Refresh Now" for manual sync and updates</li>
          <li>• Turn off auto-refresh to save resources when not actively viewing</li>
        </ul>
      </div>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Photos Loaded: {photos.length}</div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Last Update: {lastUpdate.toLocaleTimeString()}</div>
        <div>Auto-Refresh: {autoRefresh ? "ON (5s)" : "OFF"}</div>
        <div>Auth Error: {authError ? "Yes" : "No"}</div>
        <div>Loading: {loading ? "Yes" : "No"}</div>
        {syncStatus && <div>Sync Status: {syncStatus}</div>}
      </div>
    </div>
  )
}
