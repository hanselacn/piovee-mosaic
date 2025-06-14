"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { signIn } from "next-auth/react"
import {
  getPusherClient,
  subscribeToPusherChannel,
  isPusherConnected,
  getPusherConnectionState,
} from "@/lib/pusher-client"

interface PhotoData {
  photoData: string
  timestamp: number
  id: string
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
  const [pusherConnected, setPusherConnected] = useState(false)
  const [pusherState, setPusherState] = useState("uninitialized")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>("")
  const channelRef = useRef<any>(null)
  const [cameraPhotos, setCameraPhotos] = useState<PhotoData[]>([])

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

  // Connect to Pusher for real-time photo updates
  useEffect(() => {
    try {
      // Get Pusher client
      const pusher = getPusherClient()

      // Update connection state immediately
      setPusherConnected(isPusherConnected())
      setPusherState(getPusherConnectionState())

      // Subscribe to the mosaic channel
      const channel = subscribeToPusherChannel("mosaic-channel")
      channelRef.current = channel

      // Handle connection state changes
      pusher.connection.bind("connected", () => {
        console.log("Pusher connected")
        setPusherConnected(true)
        setPusherState("connected")
      })

      pusher.connection.bind("disconnected", () => {
        console.log("Pusher disconnected")
        setPusherConnected(false)
        setPusherState("disconnected")
      })

      pusher.connection.bind("error", (error: any) => {
        console.error("Pusher connection error:", error)
        setPusherConnected(false)
      })

      pusher.connection.bind("state_change", (states: any) => {
        console.log("Pusher state changed:", states.previous, "->", states.current)
        setPusherState(states.current)
        setPusherConnected(states.current === "connected")
      })

      // Listen for new photos
      channel.bind("new-photo", (data: PhotoData) => {
        console.log("New photo received:", data)
        setPhotos((prev) => [...prev, data])
        setLastUpdate(new Date())
      })

      // Force connection if not already connected
      if (pusher.connection.state !== "connected") {
        console.log("Forcing Pusher connection...")
        pusher.connect()
      }
    } catch (error) {
      console.error("Error setting up Pusher:", error)
    }

    // Clean up
    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all()
      }
    }
  }, [])

  // Get main image
  const fetchMainImage = async () => {
    try {
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
      setAuthError(false)
    } catch (error) {
      console.error("Error fetching main image:", error)
    }
  }

  // Get camera photos from Google Drive
  const fetchCameraPhotos = async () => {
    try {
      console.log("📸 Fetching camera photos...")
      const response = await fetch("/api/camera-photos")

      if (response.ok) {
        const data = await response.json()
        console.log(`📷 Loaded ${data.photos.length} camera photos`)
        setCameraPhotos(data.photos || [])
      } else {
        console.error("Failed to fetch camera photos:", response.status)
        setCameraPhotos([])
      }
    } catch (error) {
      console.error("Error fetching camera photos:", error)
      setCameraPhotos([])
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

  // Controlled auto-refresh for main image every 30 seconds when enabled
  useEffect(() => {
    if (autoRefresh && !authError) {
      const interval = setInterval(() => {
        fetchMainImage()
        fetchCameraPhotos() // Add this line
      }, 30000) // 30 seconds for main image only

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

  // Manual refresh
  const handleManualRefresh = () => {
    fetchMainImage()
    fetchCameraPhotos() // Add this line
  }

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

      // Combine real-time photos and camera photos
      const allPhotos = [...photos, ...cameraPhotos]
      console.log(
        `🎨 Drawing mosaic with ${allPhotos.length} photos (${photos.length} real-time + ${cameraPhotos.length} camera)`,
      )

      // Draw photos in grid cells
      allPhotos.forEach((photo, index) => {
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
        photoImg.src = photo.photoData
      })
    }
    img.src = mainImage
  }, [mainImage, photos, cameraPhotos, tileSize]) // Add cameraPhotos to dependencies

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

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  // Clear all photos
  const clearPhotos = async () => {
    if (confirm("Clear all photos from the mosaic? This will delete camera photos from Google Drive.")) {
      // Clear real-time photos
      setPhotos([])

      // Clear camera photos from Google Drive
      try {
        const response = await fetch("/api/camera-photos", { method: "DELETE" })
        if (response.ok) {
          setCameraPhotos([])
          console.log("✅ Camera photos cleared from Google Drive")
        } else {
          console.error("Failed to clear camera photos")
        }
      } catch (error) {
        console.error("Error clearing camera photos:", error)
      }
    }
  }

  // Manual refresh
  const handleRefresh = () => {
    fetchMainImage()
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
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${pusherConnected ? "bg-green-500" : "bg-red-500"}`}></div>
            <span>Real-time: {pusherConnected ? "Connected" : "Disconnected"}</span>
          </div>
          <span>
            Photos: {photos.length + cameraPhotos.length} ({photos.length} real-time + {cameraPhotos.length} camera)
          </span>

          {/* Controls */}
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
              🔄 Refresh
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
          <li>• Photos appear instantly on the mosaic via real-time connection</li>
          <li>• Click "Save Mosaic" to save the completed collage to Google Drive</li>
          <li>• Use "Clear Photos" to start over with a clean mosaic</li>
        </ul>
      </div>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Real-time Photos: {photos.length}</div>
        <div>Camera Photos: {cameraPhotos.length}</div>
        <div>Total Photos: {photos.length + cameraPhotos.length}</div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Last Update: {lastUpdate.toLocaleTimeString()}</div>
        <div>Pusher Connected: {pusherConnected ? "Yes" : "No"}</div>
        <div>Pusher State: {pusherState}</div>
        <div>Auto-Refresh: {autoRefresh ? "ON (30s)" : "OFF"}</div>
        <div>Auth Error: {authError ? "Yes" : "No"}</div>
        <div>Loading: {loading ? "Yes" : "No"}</div>
      </div>
    </div>
  )
}
