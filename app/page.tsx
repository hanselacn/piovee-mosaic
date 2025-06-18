"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { getPusherClient, subscribeToPusherChannel } from "@/lib/pusher-client"

interface PhotoData {
  photoData: string
  timestamp: number
  id: string
  fileName?: string
  tileIndex?: number
}

interface MosaicState {
  cols: number
  rows: number
  tileSize: number
  totalTiles: number
  currentIndex: number
  tileOrder: number[]
}

export default function Home() {
  // Core state
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [status, setStatus] = useState<string>("")

  // Mosaic state
  const [mosaicState, setMosaicState] = useState<MosaicState>({
    cols: 0,
    rows: 0,
    tileSize: 50,
    totalTiles: 0,
    currentIndex: 0,
    tileOrder: [],
  })
  const [mosaicReady, setMosaicReady] = useState(false)

  // Refs for DOM elements
  const mosaicRef = useRef<HTMLDivElement>(null)
  const photoLayerRef = useRef<HTMLDivElement>(null)
  const whiteLayerRef = useRef<HTMLDivElement>(null)

  // Handle new photo from Pusher
  const handleNewPhoto = useCallback(
    (photoData: PhotoData) => {
      setPhotos((prev) => {
        // Get current state to determine if we can add the photo
        const currentIndex = mosaicState.currentIndex
        const totalTiles = mosaicState.totalTiles
        const tileOrder = mosaicState.tileOrder

        if (!mosaicReady || currentIndex >= totalTiles) {
          console.log("Cannot add photo - mosaic not ready or no tiles available")
          return prev
        }

        const tileIndex = tileOrder[currentIndex]

        // Update photo layer
        if (photoLayerRef.current) {
          const tile = photoLayerRef.current.children[tileIndex] as HTMLElement
          if (tile) {
            tile.style.backgroundImage = `url('${photoData.photoData}')`
            tile.style.opacity = "1"
          }
        }

        // Update white layer
        if (whiteLayerRef.current) {
          const tile = whiteLayerRef.current.children[tileIndex] as HTMLElement
          if (tile) {
            tile.style.opacity = "0"
            tile.style.transform = "scale(0.8)"
          }
        }

        // Update mosaic state
        setMosaicState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))

        // Return updated photos array
        return [...prev, { ...photoData, tileIndex }]
      })
    },
    [mosaicReady, mosaicState.currentIndex, mosaicState.totalTiles, mosaicState.tileOrder]
  )

  // Create mosaic grid
  const createMosaic = useCallback(async () => {
    if (!mainImage || !mosaicRef.current || !photoLayerRef.current || !whiteLayerRef.current) return

    const img = new Image()
    img.src = mainImage

    await new Promise((resolve) => {
      img.onload = resolve
    })

    const aspectRatio = img.width / img.height
    const { tileSize } = mosaicState
    
    // Calculate grid size based on container and ensure it's not smaller than image
    const containerWidth = mosaicRef.current.clientWidth
    // Calculate minimum required columns and rows
    const minCols = Math.ceil(img.width / tileSize)
    const minRows = Math.ceil(img.height / tileSize)
    // Calculate actual columns based on container width, but not less than minimum
    const cols = Math.max(Math.floor(containerWidth / tileSize), minCols)
    const rows = Math.max(Math.floor(cols / aspectRatio), minRows)
    const totalTiles = cols * rows

    // Generate randomized tile order
    const tileOrder = Array.from({ length: totalTiles }, (_, i) => i)
    for (let i = tileOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileOrder[i], tileOrder[j]] = [tileOrder[j], tileOrder[i]]
    }

    // Update mosaic state
    setMosaicState(prev => ({
      ...prev,
      cols,
      rows,
      totalTiles,
      tileOrder,
      currentIndex: 0
    }))

    // Create photo layer tiles
    const photoFragment = document.createDocumentFragment()
    for (let i = 0; i < totalTiles; i++) {
      const tile = document.createElement('div')
      tile.className = 'absolute bg-cover bg-center transition-all duration-500'
      tile.style.width = `${tileSize}px`
      tile.style.height = `${tileSize}px`
      tile.style.left = `${(i % cols) * tileSize}px`
      tile.style.top = `${Math.floor(i / cols) * tileSize}px`
      tile.style.opacity = '0'
      photoFragment.appendChild(tile)
    }
    photoLayerRef.current.innerHTML = ''
    photoLayerRef.current.appendChild(photoFragment)

    // Create white layer tiles
    const whiteFragment = document.createDocumentFragment()
    for (let i = 0; i < totalTiles; i++) {
      const tile = document.createElement('div')
      tile.className = 'absolute bg-white transition-all duration-500'
      tile.style.width = `${tileSize}px`
      tile.style.height = `${tileSize}px`
      tile.style.left = `${(i % cols) * tileSize}px`
      tile.style.top = `${Math.floor(i / cols) * tileSize}px`
      whiteFragment.appendChild(tile)
    }
    whiteLayerRef.current.innerHTML = ''
    whiteLayerRef.current.appendChild(whiteFragment)

    // Set mosaic ready state
    setMosaicReady(true)
  }, [mainImage, mosaicState.tileSize])

  // Load main image
  const loadMainImage = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/main-image")
      const data = await response.json()

      if (data.mainImage?.dataUrl) {
        setMainImage(data.mainImage.dataUrl)
      }
    } catch (err) {
      setError("Failed to load main image")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Effect: Load main image on mount
  useEffect(() => {
    loadMainImage()
  }, [])

  // Effect: Create mosaic when main image is loaded
  useEffect(() => {
    if (mainImage && mosaicRef.current) {
      console.log("Creating mosaic from main image")
      createMosaic()
    }
  }, [mainImage, createMosaic])

  // Effect: Set up Pusher subscription
  useEffect(() => {
    if (!mosaicReady) {
      console.log("Mosaic not ready, skipping Pusher setup")
      return
    }

    const pusher = getPusherClient()
    if (!pusher) {
      console.error("Pusher client not available")
      return
    }

    console.log("Setting up Pusher subscription")
    let retryCount = 0
    const maxRetries = 3

    const setupSubscription = () => {
      try {
        const unsubscribe = subscribeToPusherChannel(
          pusher,
          "camera-channel",
          "photo-uploaded",
          async (data: { fileName: string }) => {
            try {
              console.log("Received photo notification:", data.fileName)
              setStatus("Downloading new photo...")
              
              const res = await fetch(`/api/camera-photos?filename=${encodeURIComponent(data.fileName)}`)
              if (!res.ok) throw new Error("Failed to fetch photo")
              
              const json = await res.json()
              console.log("Received photo data:", json.photos?.[0]?.fileName)
              
              if (json.photos?.[0]?.photoData) {
                handleNewPhoto(json.photos[0])
                setStatus("✅ Photo added to mosaic")
                setTimeout(() => setStatus(""), 3000)
              } else {
                throw new Error("No photo data received")
              }
            } catch (err) {
              console.error("Error fetching photo:", err)
              setStatus("❌ Failed to add photo")
              setTimeout(() => setStatus(""), 3000)

              // Retry subscription on error if we haven't exceeded max retries
              if (retryCount < maxRetries) {
                retryCount++
                console.log(`Retrying Pusher subscription (attempt ${retryCount})`)
                unsubscribe?.()
                setupSubscription()
              }
            }
          }
        )

        return unsubscribe
      } catch (error) {
        console.error("Error setting up Pusher subscription:", error)
        return undefined
      }
    }

    const unsubscribe = setupSubscription()

    return () => {
      console.log("Cleaning up Pusher subscription")
      unsubscribe?.()
    }
  }, [mosaicReady, handleNewPhoto])

  // Apply next photo to a random tile (replace white with photo using soft-light)
  const applyNextPhoto = () => {
    if (!mosaicReady || mosaicState.currentIndex >= mosaicState.tileOrder.length || photos.length === 0) {
      console.log("Cannot apply photo: mosaic not ready or no tiles/photos available")
      return
    }

    const photoIndex = mosaicState.currentIndex % photos.length
    const tileIndex = mosaicState.tileOrder[mosaicState.currentIndex]
    const photo = photos[photoIndex]

    const photoTiles = photoLayerRef.current?.children
    const whiteTiles = whiteLayerRef.current?.children

    if (photoTiles && whiteTiles && photoTiles[tileIndex] && whiteTiles[tileIndex]) {
      const photoTile = photoTiles[tileIndex] as HTMLElement
      const whiteTile = whiteTiles[tileIndex] as HTMLElement

      console.log(`🖼️ Applying photo ${photoIndex} to tile ${tileIndex}`)

      // First, set up the photo tile with the image
      photoTile.style.backgroundImage = `url('${photo.photoData}')`

      // Then animate: fade out white tile and fade in photo tile
      setTimeout(() => {
        whiteTile.style.opacity = "0"
        photoTile.style.opacity = "1"
      }, 50)

      setMosaicState((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
    }
  }

  // Save mosaic to Google Drive
  const saveMosaicToGoogleDrive = async () => {
    if (!mosaicRef.current || !mosaicReady) return;

    try {
      setStatus("Preparing mosaic for save...");

      // Create a canvas with the same dimensions as the mosaic
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Set canvas size to match mosaic
      const mosaic = mosaicRef.current;
      canvas.width = mosaic.clientWidth;
      canvas.height = mosaic.clientHeight;

      // Draw main image
      const mainImg = new Image();
      await new Promise((resolve, reject) => {
        mainImg.onload = resolve;
        mainImg.onerror = reject;
        mainImg.src = mainImage!;
      });
      ctx.drawImage(mainImg, 0, 0, canvas.width, canvas.height);

      // Draw photo tiles
      const photoTiles = photoLayerRef.current?.children;
      if (photoTiles) {
        const { cols, rows, tileSize } = mosaicState;
        
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          if (!photo.tileIndex) continue;

          const row = Math.floor(photo.tileIndex / cols);
          const col = photo.tileIndex % cols;
          const x = col * tileSize;
          const y = row * tileSize;

          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = photo.photoData;
          });

          // Apply soft-light blend mode
          ctx.globalCompositeOperation = 'soft-light';
          ctx.drawImage(img, x, y, tileSize, tileSize);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.95
        );
      });

      // Prepare form data
      const formData = new FormData();
      formData.append("file", blob, `mosaic_${new Date().toISOString()}.jpg`);

      setStatus("Uploading to Google Drive...");

      // Upload to Google Drive
      const response = await fetch("/api/save-mosaic", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload to Google Drive");
      }

      const data = await response.json();
      setStatus("✅ Mosaic saved to Google Drive!");
      setTimeout(() => setStatus(""), 3000);

    } catch (err) {
      console.error("Error saving mosaic:", err);
      setStatus("❌ Failed to save mosaic");
      setTimeout(() => setStatus(""), 5000);
    }
  }
  // Reset the mosaic
  const resetMosaic = async () => {
    if (!confirm('Are you sure you want to reset the mosaic? This will delete all photos and the main image.')) {
      return
    }

    try {
      setStatus('Resetting mosaic...')

      // Reset state first
      setPhotos([])
      setMainImage(null)
      setMosaicState({
        cols: 0,
        rows: 0,
        tileSize: 50,
        totalTiles: 0,
        currentIndex: 0,
        tileOrder: []
      })
      setMosaicReady(false)

      // Clear DOM
      if (photoLayerRef.current) photoLayerRef.current.innerHTML = ''
      if (whiteLayerRef.current) whiteLayerRef.current.innerHTML = ''

      setStatus('✅ Mosaic reset complete')
      setTimeout(() => setStatus(''), 3000)
    } catch (err) {
      console.error('Error resetting mosaic:', err)
      setStatus('❌ Failed to reset mosaic')
      setTimeout(() => setStatus(''), 3000)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Loading Mosaic</h2>
            <p className="text-gray-500">Please wait while we set up your mosaic...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <Alert variant="destructive" className="max-w-4xl mx-auto">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // No main image state
  if (!mainImage) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Welcome to Mosaic Creator</h2>
            <p className="text-gray-500 mb-8">Upload a main image to start creating your mosaic</p>
            <Button asChild>
              <Link href="/upload">Upload Main Image</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main mosaic display
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <Card className="max-w-6xl mx-auto">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-2">Live Mosaic Display</h1>
              <div className="flex gap-4 text-sm text-gray-500">
                <span>Photos: {mosaicState.currentIndex}/{mosaicState.totalTiles}</span>
                <span>Grid: {mosaicState.cols}×{mosaicState.rows}</span>
                <span>Tile: {mosaicState.tileSize}px</span>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" asChild>
                <Link href="/upload">Change Image</Link>
              </Button>
              <Button 
                variant="secondary" 
                onClick={saveMosaicToGoogleDrive}
                disabled={!mosaicReady}
              >
                Save to Drive
              </Button>
              <Button 
                variant="destructive" 
                onClick={resetMosaic}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{
                width: `${(mosaicState.currentIndex / mosaicState.totalTiles) * 100}%`
              }}
            />
          </div>

          {status && (
            <div className="mb-4">
              <Alert>
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Mosaic display */}
          <div
            ref={mosaicRef}
            className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden"
          >
            {mainImage && (
              <img
                src={mainImage}
                alt="Main"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0">
              <div
                ref={photoLayerRef}
                className="absolute inset-0 mix-blend-soft-light"
              />
              <div
                ref={whiteLayerRef}
                className="absolute inset-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
