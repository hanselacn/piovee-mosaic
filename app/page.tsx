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
  tileIndex?: number
}

export default function Home() {
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [tileSize, setTileSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const mosaicRef = useRef<HTMLDivElement>(null)
  const photoLayerRef = useRef<HTMLDivElement>(null)
  const whiteLayerRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>("")

  // Mosaic state
  const [mosaicReady, setMosaicReady] = useState(false)
  const [totalTiles, setTotalTiles] = useState(0)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [tileOrder, setTileOrder] = useState<number[]>([])
  const [cols, setCols] = useState(0)
  const [rows, setRows] = useState(0)

  // Polling states
  const [autoPolling, setAutoPolling] = useState(true)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastPhotoCheck, setLastPhotoCheck] = useState<Date>(new Date())
  const [photoCheckStatus, setPhotoCheckStatus] = useState<string>("Ready")

  // Handle authentication error
  const handleAuthError = () => {
    setAuthError(true)
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
        const imageDataUrl = mainImageData.mainImage?.dataUrl
        setMainImage(imageDataUrl || null)
        console.log("✅ Main image loaded")
      } else {
        console.error("❌ Main image fetch failed:", mainImageResponse.status)
        if (mainImageResponse.status === 401) {
          const errorData = await mainImageResponse.json()
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

  // Get camera photos from Google Drive Camera Photos folder
  const fetchCameraPhotos = async (showStatus = false) => {
    try {
      if (showStatus) {
        setPhotoCheckStatus("Checking for new photos...")
      }

      console.log("📸 Fetching camera photos from Camera Photos folder...")
      const response = await fetch("/api/camera-photos")

      if (response.ok) {
        const data = await response.json()
        const newPhotos = data.photos || []

        console.log(`📷 Found ${newPhotos.length} photos from Camera Photos folder`)

        if (newPhotos.length > 0) {
          // Format photos to match expected structure
          const formattedPhotos = newPhotos.map((photo: any) => ({
            id: photo.id || photo.fileName || `photo-${Date.now()}-${Math.random()}`,
            photoData: photo.photoData || photo.dataUrl,
            timestamp: photo.timestamp || new Date(photo.createdTime || Date.now()).getTime(),
            fileName: photo.fileName || photo.name,
          }))

          // Check for new photos by comparing IDs
          const existingIds = new Set(photos.map((p) => p.id))
          const actuallyNewPhotos = formattedPhotos.filter((photo: PhotoData) => !existingIds.has(photo.id))

          if (actuallyNewPhotos.length > 0) {
            console.log(`✨ Found ${actuallyNewPhotos.length} new photos from Camera Photos folder`)

            setPhotos((prevPhotos) => {
              const combined = [...prevPhotos, ...actuallyNewPhotos]
              return combined.sort((a, b) => b.timestamp - a.timestamp)
            })

            // Apply new photos to mosaic if ready
            if (mosaicReady) {
              actuallyNewPhotos.forEach(() => {
                applyNextPhoto()
              })
            }

            if (showStatus) {
              setPhotoCheckStatus(`✅ Found ${actuallyNewPhotos.length} new photos from Camera Photos`)
            }
          } else {
            if (showStatus) {
              setPhotoCheckStatus("✅ No new photos in Camera Photos")
            }
          }
        } else {
          if (showStatus) {
            setPhotoCheckStatus("✅ No photos in Camera Photos folder")
          }
        }

        setLastPhotoCheck(new Date())
      } else {
        console.error("❌ Failed to fetch camera photos:", response.status)
        if (showStatus) {
          setPhotoCheckStatus("❌ Failed to check Camera Photos folder")
        }
      }
    } catch (error) {
      console.error("❌ Error fetching camera photos:", error)
      if (showStatus) {
        setPhotoCheckStatus("❌ Error checking Camera Photos folder")
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
      }, 10000)

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
  }, [autoPolling, authError])

  // Create mosaic structure when main image loads
  useEffect(() => {
    if (mainImage && mosaicRef.current) {
      createMosaicStructure()
    }
  }, [mainImage, tileSize])

  // Create the layered mosaic structure with white overlay
  const createMosaicStructure = () => {
    if (!mosaicRef.current || !photoLayerRef.current || !whiteLayerRef.current) return

    // Calculate dimensions based on a reference size
    const containerWidth = 800 // Fixed width for consistency
    const newCols = Math.floor(containerWidth / tileSize)
    const newRows = Math.floor((containerWidth * 0.6) / tileSize) // 4:3 aspect ratio
    const newTotalTiles = newCols * newRows

    console.log(`🎨 Creating mosaic: ${newCols}x${newRows} = ${newTotalTiles} tiles`)

    setCols(newCols)
    setRows(newRows)
    setTotalTiles(newTotalTiles)

    // Create random tile order
    const newTileOrder = Array.from({ length: newTotalTiles }, (_, i) => i)
    newTileOrder.sort(() => Math.random() - 0.5)
    setTileOrder(newTileOrder)

    // Set container dimensions
    const mosaicWidth = newCols * tileSize
    const mosaicHeight = newRows * tileSize

    mosaicRef.current.style.width = `${mosaicWidth}px`
    mosaicRef.current.style.height = `${mosaicHeight}px`

    // Clear existing tiles
    photoLayerRef.current.innerHTML = ""
    whiteLayerRef.current.innerHTML = ""

    // Set up grid layouts
    const gridStyle = {
      display: "grid",
      gridTemplateColumns: `repeat(${newCols}, ${tileSize}px)`,
      gridTemplateRows: `repeat(${newRows}, ${tileSize}px)`,
      position: "absolute" as const,
      inset: "0",
    }

    Object.assign(photoLayerRef.current.style, gridStyle)
    Object.assign(whiteLayerRef.current.style, gridStyle)

    // Create photo tiles (hidden initially, with soft-light blend mode)
    for (let i = 0; i < newTotalTiles; i++) {
      const photoTile = document.createElement("div")
      photoTile.className = "photo-tile"
      photoTile.style.cssText = `
    width: ${tileSize}px;
    height: ${tileSize}px;
    background-size: cover;
    background-position: center;
    opacity: 0;
    transition: opacity 0.8s ease-in-out;
    border: 1px solid rgba(255,255,255,0.1);
  `
      photoLayerRef.current.appendChild(photoTile)
    }

    // Create white overlay tiles (visible initially, covering the main image)
    for (let i = 0; i < newTotalTiles; i++) {
      const whiteTile = document.createElement("div")
      whiteTile.className = "white-tile"
      whiteTile.style.cssText = `
        width: ${tileSize}px;
        height: ${tileSize}px;
        background-color: white;
        opacity: 1;
        transition: opacity 0.8s ease-in-out;
        border: 1px solid rgba(0,0,0,0.1);
      `
      whiteLayerRef.current.appendChild(whiteTile)
    }

    setMosaicReady(true)
    setCurrentPhotoIndex(0)
    console.log("✅ Mosaic structure created - white tiles covering main image")
  }

  // Apply next photo to a random tile (replace white with photo using soft-light)
  const applyNextPhoto = () => {
    if (!mosaicReady || currentPhotoIndex >= tileOrder.length || photos.length === 0) {
      console.log("Cannot apply photo: mosaic not ready or no tiles/photos available")
      return
    }

    const photoIndex = currentPhotoIndex % photos.length
    const tileIndex = tileOrder[currentPhotoIndex]
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

      setCurrentPhotoIndex((prev) => prev + 1)
    }
  }

  // Save mosaic to Google Drive
  const saveMosaicToGoogleDrive = async () => {
    if (!mosaicRef.current) {
      alert("No mosaic to save!")
      return
    }

    setIsSaving(true)
    setSaveStatus("Preparing mosaic...")

    try {
      // Create a canvas to capture the mosaic
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Could not create canvas context")

      const mosaicWidth = cols * tileSize
      const mosaicHeight = rows * tileSize
      canvas.width = mosaicWidth
      canvas.height = mosaicHeight

      // Draw main image as background
      if (mainImage) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = mainImage
        })
        ctx.drawImage(img, 0, 0, mosaicWidth, mosaicHeight)
      }

      // Draw white tiles first
      const whiteTiles = whiteLayerRef.current?.children
      if (whiteTiles) {
        ctx.fillStyle = "white"
        for (let i = 0; i < whiteTiles.length; i++) {
          const tile = whiteTiles[i] as HTMLElement
          if (tile.style.opacity === "1") {
            const row = Math.floor(i / cols)
            const col = i % cols
            const x = col * tileSize
            const y = row * tileSize
            ctx.fillRect(x, y, tileSize, tileSize)
          }
        }
      }

      // Draw photos on top with blend mode simulation
      const photoTiles = photoLayerRef.current?.children
      if (photoTiles) {
        ctx.globalCompositeOperation = "soft-light"
        for (let i = 0; i < photoTiles.length; i++) {
          const tile = photoTiles[i] as HTMLElement
          if (tile.style.opacity === "1" && tile.style.backgroundImage) {
            const row = Math.floor(i / cols)
            const col = i % cols
            const x = col * tileSize
            const y = row * tileSize

            // Extract image URL from background-image style
            const bgImage = tile.style.backgroundImage
            const urlMatch = bgImage.match(/url$$["']?([^"']*)["']?$$/)
            if (urlMatch) {
              const photoImg = new Image()
              photoImg.crossOrigin = "anonymous"
              await new Promise((resolve, reject) => {
                photoImg.onload = resolve
                photoImg.onerror = reject
                photoImg.src = urlMatch[1]
              })
              ctx.drawImage(photoImg, x, y, tileSize, tileSize)
            }
          }
        }
        ctx.globalCompositeOperation = "source-over" // Reset blend mode
      }

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
    fetchCameraPhotos(true)
  }

  // Clear all photos from Camera Photos folder
  const clearPhotos = async () => {
    if (confirm("Clear all photos from the mosaic? This will delete camera photos from Camera Photos folder.")) {
      setPhotos([])
      setCurrentPhotoIndex(0)

      // Reset all tiles to white
      const photoTiles = photoLayerRef.current?.children
      const whiteTiles = whiteLayerRef.current?.children

      if (photoTiles && whiteTiles) {
        for (let i = 0; i < photoTiles.length; i++) {
          const photoTile = photoTiles[i] as HTMLElement
          const whiteTile = whiteTiles[i] as HTMLElement

          photoTile.style.opacity = "0"
          photoTile.style.backgroundImage = ""
          whiteTile.style.opacity = "1"
        }
      }

      try {
        const response = await fetch("/api/camera-photos", { method: "DELETE" })
        if (response.ok) {
          console.log("✅ Camera photos cleared from Camera Photos folder")
        }
      } catch (error) {
        console.error("Error clearing camera photos from Camera Photos folder:", error)
      }
    }
  }

  // Manual photo application
  const handleApplyPhoto = () => {
    applyNextPhoto()
  }

  const getRevealPercentage = () => {
    if (totalTiles === 0) return 0
    return Math.round((currentPhotoIndex / totalTiles) * 100)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">🎨 Layered Mosaic Display</h1>

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
          <span>
            Applied: {currentPhotoIndex}/{totalTiles}
          </span>
          <span>Revealed: {getRevealPercentage()}%</span>

          {/* Photo check status */}
          <span className="text-sm text-gray-600">Status: {photoCheckStatus}</span>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <Button onClick={handleManualRefresh} variant="outline" size="sm">
              🔄 Check Now
            </Button>
            <Button
              onClick={handleApplyPhoto}
              variant="outline"
              size="sm"
              disabled={!mosaicReady || photos.length === 0}
            >
              🖼️ Apply Photo
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

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-500 ease-in-out"
            style={{ width: `${getRevealPercentage()}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">Mosaic Enhancement Progress: {getRevealPercentage()}%</p>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
            ) : mainImage ? (
              <div className="flex flex-col items-center">
                {/* Main mosaic container */}
                <div
                  ref={mosaicRef}
                  className="relative border border-gray-300"
                  style={{
                    backgroundImage: `url('${mainImage}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {/* Photo layer - with soft-light blend mode applied to the entire layer */}
                  <div
                    ref={photoLayerRef}
                    className="absolute inset-0"
                    style={{
                      zIndex: 1,
                      mixBlendMode: "soft-light",
                    }}
                  />

                  {/* White overlay layer - positioned above photo layer */}
                  <div ref={whiteLayerRef} className="absolute inset-0" style={{ zIndex: 2 }} />
                </div>

                <div className="text-xs text-gray-500 mt-2 text-center">
                  Mosaic: {mosaicReady ? "Ready" : "Loading"} | Grid: {cols}×{rows} | Tile: {tileSize}px
                </div>
              </div>
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
        <h3 className="font-bold mb-2 text-blue-800">How the Layered Mosaic Works:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Upload a main image first - it becomes the background</li>
          <li>• White tiles initially cover the entire main image completely</li>
          <li>• Camera photos replace white tiles with soft-light blend effect</li>
          <li>• Each new photo reveals more of the enhanced main image underneath</li>
          <li>• The soft-light blend creates a beautiful enhancement effect</li>
          <li>• Use "Apply Photo" to manually place the next photo</li>
          <li>• Auto-check polls Google Drive every 10 seconds for new photos</li>
        </ul>
      </div>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Total Photos: {photos.length}</div>
        <div>
          Applied Photos: {currentPhotoIndex}/{totalTiles}
        </div>
        <div>Main Image: {mainImage ? "Loaded" : "Not Loaded"}</div>
        <div>Mosaic Ready: {mosaicReady ? "Yes" : "No"}</div>
        <div>
          Grid Size: {cols}×{rows} = {totalTiles} tiles
        </div>
        <div>
          Tile Size: {tileSize}×{tileSize}px
        </div>
        <div>Enhancement: {getRevealPercentage()}%</div>
        <div>Last Photo Check: {lastPhotoCheck.toLocaleTimeString()}</div>
        <div>Auto-check: {autoPolling ? "ON (10s)" : "OFF"}</div>
        <div>Check Status: {photoCheckStatus}</div>
      </div>
    </div>
  )
}
