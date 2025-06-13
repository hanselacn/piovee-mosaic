"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import type PusherClient from "pusher-js"
import { initializePusher } from "@/lib/pusher-client"

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
  const pusherRef = useRef<PusherClient | null>(null)
  const channelRef = useRef<any>(null)

  // Connect to Pusher using server action
  useEffect(() => {
    async function connectToPusher() {
      try {
        const pusher = await initializePusher()
        pusherRef.current = pusher

        // Subscribe to the mosaic channel
        const channel = pusher.subscribe("mosaic-channel")
        channelRef.current = channel

        // Handle connection status
        pusher.connection.bind("connected", () => {
          console.log("Connected to Pusher")
          setPusherConnected(true)
        })

        pusher.connection.bind("disconnected", () => {
          console.log("Disconnected from Pusher")
          setPusherConnected(false)
        })

        // Listen for new photos
        channel.bind("new-photo", (data: PhotoData) => {
          console.log("New photo received:", data)
          setPhotos((prev) => [...prev, data])
        })
      } catch (error) {
        console.error("Error connecting to Pusher:", error)
      }
    }

    connectToPusher()

    // Clean up
    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all()
      }
      if (pusherRef.current) {
        pusherRef.current.unsubscribe("mosaic-channel")
        pusherRef.current.disconnect()
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Mosaic Display</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${pusherConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span>{pusherConnected ? "Connected" : "Disconnected"}</span>
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
    </div>
  )
}
