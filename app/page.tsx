"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { getPusherClient, subscribeToPusherChannel, isPusherConnected } from "@/lib/pusher-client"
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const channelRef = useRef<any>(null)

  // Connect to Pusher
  useEffect(() => {
    let pusher: PusherClient | null = null

    try {
      // Get Pusher client
      pusher = getPusherClient()

      // Update connection state immediately
      setPusherConnected(isPusherConnected())

      // Subscribe to the mosaic channel
      const channel = subscribeToPusherChannel("mosaic-channel")
      channelRef.current = channel

      // Handle connection state changes
      pusher.connection.bind("connected", () => {
        console.log("Pusher connected")
        setPusherConnected(true)
      })

      pusher.connection.bind("disconnected", () => {
        console.log("Pusher disconnected")
        setPusherConnected(false)
      })

      // Listen for new photos
      channel.bind("new-photo", (data: PhotoData) => {
        console.log("New photo received:", data)
        setPhotos((prev) => [...prev, data])
      })

      // Debug connection state
      console.log("Initial Pusher state:", pusher.connection.state)

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
      // Note: We don't disconnect Pusher here to maintain the singleton
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
      const pusher = getPusherClient()
      pusher.connect()
    } catch (error) {
      console.error("Error reconnecting to Pusher:", error)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Mosaic Display</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${pusherConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span>{pusherConnected ? "Connected" : "Disconnected"}</span>
          {!pusherConnected && (
            <button onClick={reconnectPusher} className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
              Reconnect
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
        <div>Pusher Connected: {pusherConnected ? "Yes" : "No"}</div>
        <div>Photos Loaded: {photos.length}</div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Environment: {process.env.NODE_ENV}</div>
        <div>Pusher App Key: {process.env.NEXT_PUBLIC_PUSHER_APP_KEY ? "Set" : "Not Set"}</div>
        <div>Pusher Cluster: {process.env.NEXT_PUBLIC_PUSHER_CLUSTER}</div>
      </div>
    </div>
  )
}
