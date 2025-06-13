"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  getPusherClient,
  subscribeToPusherChannel,
  isPusherConnected,
  getPusherConnectionState,
  checkPusherCredentials,
} from "@/lib/pusher-client"
import type PusherClient from "pusher-js"

interface PhotoData {
  photoData: string
  tileIndex?: number
  timestamp: number
}

export default function Home() {
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [tileSize, setTileSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [pusherConnected, setPusherConnected] = useState(false)
  const [pusherState, setPusherState] = useState("uninitialized")
  const [pusherError, setPusherError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const channelRef = useRef<any>(null)

  // Function to update connection state
  const updateConnectionState = () => {
    const connected = isPusherConnected()
    const state = getPusherConnectionState()

    console.log("Updating connection state:", { connected, state })
    setPusherConnected(connected)
    setPusherState(state)
  }

  // Connect to Pusher
  useEffect(() => {
    let pusher: PusherClient | null = null
    let stateCheckInterval: NodeJS.Timeout | null = null

    try {
      // Check credentials first
      const credentials = checkPusherCredentials()
      console.log("Pusher credentials check:", credentials)

      if (!credentials.hasKey || !credentials.hasCluster) {
        setPusherError(`Missing credentials: Key=${credentials.hasKey}, Cluster=${credentials.hasCluster}`)
        return
      }

      // Get Pusher client
      pusher = getPusherClient()

      // Update connection state immediately
      updateConnectionState()

      // Subscribe to the mosaic channel
      const channel = subscribeToPusherChannel("mosaic-channel")
      channelRef.current = channel

      // Handle connection state changes
      pusher.connection.bind("connected", () => {
        console.log("Pusher connected")
        setPusherConnected(true)
        setPusherState("connected")
        setPusherError(null)
      })

      pusher.connection.bind("disconnected", () => {
        console.log("Pusher disconnected")
        setPusherConnected(false)
        setPusherState("disconnected")
      })

      pusher.connection.bind("error", (error: any) => {
        console.error("Pusher connection error:", error)
        setPusherError(error.message || "Connection error")
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
      })

      // Periodic state check to ensure UI stays in sync
      stateCheckInterval = setInterval(() => {
        updateConnectionState()
      }, 2000)

      // Debug connection state
      console.log("Initial Pusher state:", pusher.connection.state)

      // Force connection if not already connected
      if (pusher.connection.state !== "connected") {
        console.log("Forcing Pusher connection...")
        pusher.connect()
      }
    } catch (error) {
      console.error("Error setting up Pusher:", error)
      setPusherError(error instanceof Error ? error.message : "Setup error")
    }

    // Clean up
    return () => {
      if (stateCheckInterval) {
        clearInterval(stateCheckInterval)
      }
      if (channelRef.current) {
        channelRef.current.unbind_all()
      }
      if (pusher) {
        pusher.connection.unbind("connected")
        pusher.connection.unbind("disconnected")
        pusher.connection.unbind("error")
        pusher.connection.unbind("state_change")
      }
    }
  }, [])

  // Get main image and photos
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Get main image
        const mainImageResponse = await fetch("/api/main-image")
        if (mainImageResponse.ok) {
          const mainImageData = await mainImageResponse.json()
          setMainImage(mainImageData.mainImage?.dataUrl || null)
        }

        // Get photos
        const photosResponse = await fetch("/api/photos")
        if (photosResponse.ok) {
          const photosData = await photosResponse.json()
          setPhotos(photosData.photos || [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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
        photoImg.src = photo.photoData
      })
    }
    img.src = mainImage
  }, [mainImage, photos, tileSize])

  // Function to manually reconnect Pusher
  const reconnectPusher = () => {
    try {
      setPusherError(null)
      const pusher = getPusherClient()
      pusher.connect()
      // Force state update after a short delay
      setTimeout(updateConnectionState, 1000)
    } catch (error) {
      console.error("Error reconnecting to Pusher:", error)
      setPusherError(error instanceof Error ? error.message : "Reconnection error")
    }
  }

  // Test function to send a test photo
  const sendTestPhoto = async () => {
    try {
      const response = await fetch("/api/send-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoData:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        }),
      })

      if (response.ok) {
        console.log("Test photo sent successfully")
      } else {
        console.error("Failed to send test photo")
      }
    } catch (error) {
      console.error("Error sending test photo:", error)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Mosaic Display</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${pusherConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span>{pusherConnected ? "Connected" : `Disconnected (${pusherState})`}</span>
          {!pusherConnected && (
            <button onClick={reconnectPusher} className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
              Reconnect
            </button>
          )}
          {pusherConnected && (
            <button onClick={sendTestPhoto} className="text-xs bg-green-500 text-white px-2 py-1 rounded ml-2">
              Test Photo
            </button>
          )}
          <span className="ml-4">Photos: {photos.length}</span>
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

      {/* Error display */}
      {pusherError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Pusher Error:</strong> {pusherError}
        </div>
      )}

      {/* Success display */}
      {pusherConnected && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <strong>✅ Pusher Connected!</strong> Ready to receive photos from camera.
        </div>
      )}

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

      {/* Debug info */}
      <div className="mt-8 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Debug Information</h3>
        <div>Pusher Connected: {pusherConnected ? "✅ Yes" : "❌ No"}</div>
        <div>Pusher State: {pusherState}</div>
        <div>Photos Loaded: {photos.length}</div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Environment: {process.env.NODE_ENV}</div>
        <div>
          Pusher App Key:{" "}
          {process.env.NEXT_PUBLIC_PUSHER_APP_KEY
            ? `${process.env.NEXT_PUBLIC_PUSHER_APP_KEY.substring(0, 10)}...`
            : "Not Set"}
        </div>
        <div>Pusher Cluster: {process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "Not Set"}</div>
        {pusherError && <div className="text-red-600">Error: {pusherError}</div>}
      </div>
    </div>
  )
}
