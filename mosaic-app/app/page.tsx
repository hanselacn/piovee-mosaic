"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

interface PhotoData {
  dataUrl: string
  tileIndex: number
  timestamp: number
  id: string
}

interface MainImageData {
  dataUrl: string
  filename: string
  uploadedAt: number
  requestedTiles: number
  actualTiles: number
  tileSize: number
  cols: number
  rows: number
}

export default function MosaicApp() {
  const collageContainerRef = useRef<HTMLDivElement>(null)
  const collageContainer2Ref = useRef<HTMLDivElement>(null)
  const mosaicRef = useRef<HTMLDivElement>(null)
  const mainImageRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")
  const [tiles, setTiles] = useState<HTMLDivElement[]>([])
  const [tiles2, setTiles2] = useState<HTMLDivElement[]>([])
  const [tileOrder, setTileOrder] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalTiles, setTotalTiles] = useState(0)
  const [mosaicReady, setMosaicReady] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([])
  const [appliedPhotos, setAppliedPhotos] = useState<PhotoData[]>([])
  const [mainImage, setMainImage] = useState<MainImageData | null>(null)
  const [mainImageLoading, setMainImageLoading] = useState(true)

  // Refs to store current values for use in callbacks
  const tilesRef = useRef<HTMLDivElement[]>([])
  const tiles2Ref = useRef<HTMLDivElement[]>([])
  const tileOrderRef = useRef<number[]>([])
  const currentIndexRef = useRef(0)

  // Load main image and photos from file on component mount
  useEffect(() => {
    loadMainImage()
    loadPhotosFromFile()
  }, [])

  useEffect(() => {
    // Only connect to WebSocket if main image is loaded
    if (!mainImage) return

    const websocket = new WebSocket("ws://localhost:8084")

    websocket.onopen = () => {
      console.log("Connected to WebSocket server")
      setConnectionStatus("connected")
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log("Received WebSocket message:", message.type)
        if (message.type === "newPhoto") {
          console.log("Adding photo to mosaic...")
          handleNewPhoto(message.data)
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
      }
    }

    websocket.onclose = () => {
      console.log("Disconnected from WebSocket server")
      setConnectionStatus("disconnected")
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      setConnectionStatus("disconnected")
    }

    return () => {
      websocket.close()
    }
  }, [mainImage])

  useEffect(() => {
    // Only create mosaic if main image is loaded
    if (!mainImage) return

    const timer = setTimeout(() => {
      createMosaic()
    }, 500)

    // Remove the resize handler completely
    return () => {
      clearTimeout(timer)
    }
  }, [mainImage])

  // Update refs when state changes
  useEffect(() => {
    tilesRef.current = tiles
  }, [tiles])

  useEffect(() => {
    tiles2Ref.current = tiles2
  }, [tiles2])

  useEffect(() => {
    tileOrderRef.current = tileOrder
  }, [tileOrder])

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  // Process pending photos when mosaic becomes ready
  useEffect(() => {
    if (mosaicReady && pendingPhotos.length > 0) {
      console.log("Processing", pendingPhotos.length, "pending photos")
      pendingPhotos.forEach((photoData) => {
        addPhotoToMosaic(photoData)
      })
      setPendingPhotos([])
    }
  }, [mosaicReady, pendingPhotos])

  // Reapply photos when mosaic is ready and we have stored photos
  useEffect(() => {
    if (mosaicReady && appliedPhotos.length > 0) {
      reapplyPhotos(appliedPhotos)
    }
  }, [mosaicReady])

  const loadMainImage = async () => {
    try {
      setMainImageLoading(true)
      const response = await fetch("/api/main-image")
      const data = await response.json()
      if (data.mainImage) {
        console.log("Loaded main image:", data.mainImage.filename)
        console.log("Perfect fit settings:", {
          requested: data.mainImage.requestedTiles,
          actual: data.mainImage.actualTiles,
          tileSize: data.mainImage.tileSize,
          grid: `${data.mainImage.cols}x${data.mainImage.rows}`,
        })
        setMainImage(data.mainImage)
      } else {
        console.log("No main image found")
        setMainImage(null)
      }
    } catch (error) {
      console.error("Error loading main image:", error)
      setMainImage(null)
    } finally {
      setMainImageLoading(false)
    }
  }

  const loadPhotosFromFile = async () => {
    try {
      const response = await fetch("/api/photos")
      const data = await response.json()
      if (data.photos) {
        console.log("Loaded", data.photos.length, "photos from file")
        setAppliedPhotos(data.photos)
        setCurrentIndex(data.photos.length)
        currentIndexRef.current = data.photos.length
      }
    } catch (error) {
      console.error("Error loading photos from file:", error)
    }
  }

  const savePhotoToFile = async (dataUrl: string, tileIndex: number) => {
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataUrl, tileIndex }),
      })
      const data = await response.json()
      if (data.success) {
        console.log("Photo saved to file:", data.photo.id)
      }
    } catch (error) {
      console.error("Error saving photo to file:", error)
    }
  }

  const resetMosaic = async () => {
    if (!confirm("Are you sure you want to reset the mosaic? This will delete all photos and the main image.")) {
      return
    }

    try {
      // Clear photos
      const photosResponse = await fetch("/api/photos", {
        method: "DELETE",
      })

      // Clear main image
      const mainImageResponse = await fetch("/api/main-image", {
        method: "DELETE",
      })

      if (photosResponse.ok && mainImageResponse.ok) {
        console.log("Mosaic reset successfully")
        setAppliedPhotos([])
        setCurrentIndex(0)
        currentIndexRef.current = 0
        setMainImage(null)
        setMosaicReady(false)
        setTiles([])
        setTiles2([])

        // Clear the containers
        if (collageContainerRef.current) collageContainerRef.current.innerHTML = ""
        if (collageContainer2Ref.current) collageContainer2Ref.current.innerHTML = ""
      }
    } catch (error) {
      console.error("Error resetting mosaic:", error)
      alert("Failed to reset mosaic")
    }
  }

  const handleNewPhoto = (dataUrl: string) => {
    if (mosaicReady && tilesRef.current.length > 0) {
      addPhotoToMosaic(dataUrl)
    } else {
      console.log("Mosaic not ready, adding photo to pending queue")
      setPendingPhotos((prev) => [...prev, dataUrl])
    }
  }

  const createMosaic = () => {
    createMosaicStructure()
  }

  const createMosaicStructure = () => {
    if (
      !collageContainerRef.current ||
      !collageContainer2Ref.current ||
      !mosaicRef.current ||
      !mainImageRef.current ||
      !mainImage
    ) {
      console.log("DOM elements or main image not ready")
      return
    }

    // Use exact settings from uploaded image for perfect fit
    const { tileSize, cols, rows, actualTiles } = mainImage
    const canvasWidth = cols * tileSize
    const canvasHeight = rows * tileSize

    console.log("Creating perfect fit mosaic:")
    console.log("- Requested tiles:", mainImage.requestedTiles)
    console.log("- Actual tiles:", actualTiles)
    console.log("- Tile size:", tileSize, "x", tileSize)
    console.log("- Grid:", cols, "x", rows)
    console.log("- Canvas size:", canvasWidth, "x", canvasHeight)
    console.log("- Coverage: 100% (perfect fit)")

    // Set the mosaic container to exact canvas size
    mosaicRef.current.style.width = `${canvasWidth}px`
    mosaicRef.current.style.height = `${canvasHeight}px`

    // Clear existing tiles
    collageContainerRef.current.innerHTML = ""
    collageContainer2Ref.current.innerHTML = ""

    const newTileOrder = Array.from({ length: actualTiles }, (_, i) => i)
    newTileOrder.sort(() => Math.random() - 0.5)

    // Photo tiles container (with soft-light blend mode)
    collageContainerRef.current.style.display = "grid"
    collageContainerRef.current.style.gridTemplateColumns = `repeat(${cols}, ${tileSize}px)`
    collageContainerRef.current.style.gridTemplateRows = `repeat(${rows}, ${tileSize}px)`
    collageContainerRef.current.style.backgroundColor = "transparent"
    collageContainerRef.current.style.mixBlendMode = "soft-light"

    // White overlay container
    collageContainer2Ref.current.style.display = "grid"
    collageContainer2Ref.current.style.gridTemplateColumns = `repeat(${cols}, ${tileSize}px)`
    collageContainer2Ref.current.style.gridTemplateRows = `repeat(${rows}, ${tileSize}px)`
    collageContainer2Ref.current.style.backgroundColor = "transparent"

    const newTiles: HTMLDivElement[] = []
    const newTiles2: HTMLDivElement[] = []

    // Create tiles - exactly fills the canvas
    for (let i = 0; i < actualTiles; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      // Photo tile (with soft-light blend mode)
      const collageTile = document.createElement("div")
      collageTile.classList.add("collage-tile")
      collageTile.style.backgroundColor = "transparent"
      collageTile.style.gridRowStart = (row + 1).toString()
      collageTile.style.gridColumnStart = (col + 1).toString()
      collageTile.style.width = `${tileSize}px`
      collageTile.style.height = `${tileSize}px`
      collageTile.style.opacity = "0" // Start invisible
      collageTile.style.transition = "all 0.5s ease-in-out"
      collageTile.style.backgroundSize = "cover"
      collageTile.style.backgroundPosition = "center"
      collageTile.style.border = "1px solid rgba(255,255,255,0.1)"
      newTiles.push(collageTile)
      collageContainerRef.current.appendChild(collageTile)

      // White overlay tile (covers the main image initially)
      const collageTile2 = document.createElement("div")
      collageTile2.classList.add("collage-tile-overlay")
      collageTile2.style.backgroundColor = "white"
      collageTile2.style.gridRowStart = (row + 1).toString()
      collageTile2.style.gridColumnStart = (col + 1).toString()
      collageTile2.style.width = `${tileSize}px`
      collageTile2.style.height = `${tileSize}px`
      collageTile2.style.opacity = "1"
      collageTile2.style.transition = "all 0.5s ease-in-out"
      collageTile2.style.border = "1px solid rgba(0,0,0,0.1)"
      newTiles2.push(collageTile2)
      collageContainer2Ref.current.appendChild(collageTile2)
    }

    // Update state and mark as ready
    setTiles(newTiles)
    setTiles2(newTiles2)
    setTileOrder(newTileOrder)
    setTotalTiles(actualTiles)

    // Update refs immediately
    tilesRef.current = newTiles
    tiles2Ref.current = newTiles2
    tileOrderRef.current = newTileOrder

    console.log("Perfect fit mosaic created with exactly", newTiles.length, "tiles")
    setMosaicReady(true)
  }

  const reapplyPhotos = (photosToReapply: PhotoData[]) => {
    console.log("Reapplying", photosToReapply.length, "photos")

    photosToReapply.forEach((photo) => {
      if (photo.tileIndex < tilesRef.current.length && tilesRef.current[photo.tileIndex]) {
        const collageTile = tilesRef.current[photo.tileIndex]
        const collageTile2 = tiles2Ref.current[photo.tileIndex]

        if (collageTile && collageTile2) {
          // Hide the white overlay
          collageTile2.style.opacity = "0"
          collageTile2.style.transform = "scale(0.8)"

          // Show the photo with soft-light blend
          collageTile.style.backgroundImage = `url('${photo.dataUrl}')`
          collageTile.style.opacity = "1"
        }
      }
    })
  }

  const addPhotoToMosaic = (dataUrl: string) => {
    console.log("addPhotoToMosaic called")

    if (currentIndexRef.current >= tileOrderRef.current.length || tilesRef.current.length === 0) {
      console.log("Cannot add photo: index out of bounds or no tiles")
      return
    }

    const tileIndex = tileOrderRef.current[currentIndexRef.current]
    const collageTile = tilesRef.current[tileIndex]
    const collageTile2 = tiles2Ref.current[tileIndex]

    console.log("Adding photo to tile index:", tileIndex)

    if (collageTile && collageTile2) {
      // Hide the white overlay to reveal the main image
      collageTile2.style.opacity = "0"
      collageTile2.style.transform = "scale(0.8)"

      // Show the photo with soft-light blend effect
      collageTile.style.backgroundImage = `url('${dataUrl}')`
      collageTile.style.opacity = "1"

      // Save photo to file
      savePhotoToFile(dataUrl, tileIndex)

      // Store the applied photo in state
      const newPhoto: PhotoData = {
        dataUrl,
        tileIndex,
        timestamp: Date.now(),
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }
      setAppliedPhotos((prev) => [...prev, newPhoto])

      console.log("Photo applied to tile", tileIndex)

      // Update the ref and state
      currentIndexRef.current = currentIndexRef.current + 1
      setCurrentIndex(currentIndexRef.current)

      console.log("Updated index to:", currentIndexRef.current)
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "#10b981"
      case "connecting":
        return "#f59e0b"
      default:
        return "#ef4444"
    }
  }

  const getRevealPercentage = () => {
    if (totalTiles === 0) return 0
    return Math.round((currentIndex / totalTiles) * 100)
  }

  // Show loading state
  if (mainImageLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111827", padding: "1rem" }}>
        <div style={{ maxWidth: "96rem", margin: "0 auto", textAlign: "center", paddingTop: "10rem" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⏳</div>
          <h1 style={{ color: "white", fontSize: "1.5rem" }}>Loading...</h1>
        </div>
      </div>
    )
  }

  // Show upload prompt if no main image
  if (!mainImage) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#111827", padding: "1rem" }}>
        <div style={{ maxWidth: "96rem", margin: "0 auto", textAlign: "center", paddingTop: "10rem" }}>
          <div style={{ fontSize: "6rem", marginBottom: "2rem" }}>🖼️</div>
          <h1 style={{ color: "white", fontSize: "2rem", marginBottom: "1rem" }}>Please Upload Main Image</h1>
          <p style={{ color: "#9ca3af", fontSize: "1.125rem", marginBottom: "2rem" }}>
            You need to upload a main image before the mosaic can start collecting photos.
          </p>
          <button
            onClick={() => router.push("/upload")}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "1rem 2rem",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              fontSize: "1.125rem",
            }}
          >
            📤 Upload Main Image
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111827", padding: "1rem" }}>
      <div style={{ maxWidth: "96rem", margin: "0 auto" }}>
        <div
          style={{
            backgroundColor: "#1f2937",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            border: "1px solid #374151",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "1.5rem", borderBottom: "1px solid #374151" }}>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                margin: "0 0 1rem 0",
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              🎨 Live Mosaic Display
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: getStatusColor(),
                  }}
                />
                <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>WebSocket: {connectionStatus}</span>
              </div>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                Photos: {currentIndex} / {totalTiles}
              </span>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Enhanced: {getRevealPercentage()}%</span>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                Grid: {mainImage.cols}×{mainImage.rows}
              </span>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                Tile: {mainImage.tileSize}×{mainImage.tileSize}px
              </span>
              <span style={{ fontSize: "0.875rem", color: mosaicReady ? "#10b981" : "#f59e0b" }}>
                Mosaic: {mosaicReady ? "Perfect Fit" : "Loading..."}
              </span>
              <span style={{ fontSize: "0.875rem", color: "#9ca3af" }}>Main: {mainImage.filename}</span>
              <button
                onClick={() => router.push("/upload")}
                style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                🖼️ Change Image
              </button>
              <button
                onClick={resetMosaic}
                style={{
                  backgroundColor: "#ef4444",
                  color: "white",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                🗑️ Reset All
              </button>
            </div>

            {/* Progress Bar */}
            <div style={{ marginTop: "1rem" }}>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#374151",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${getRevealPercentage()}%`,
                    height: "100%",
                    backgroundColor: "#10b981",
                    transition: "width 0.5s ease-in-out",
                  }}
                />
              </div>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem", textAlign: "center" }}>
                Perfect Fit Enhancement Progress
              </p>
            </div>
          </div>

          <div style={{ padding: "1.5rem" }}>
            <div
              ref={mainImageRef}
              style={{
                width: `${mainImage.cols * mainImage.tileSize}px`,
                height: `${mainImage.rows * mainImage.tileSize}px`,
                backgroundColor: "#374151",
                borderRadius: "0.5rem",
                position: "relative",
                backgroundImage: `url('${mainImage.dataUrl}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                margin: "0 auto", // Center the perfect-fit container
              }}
            >
              <div ref={mosaicRef} style={{ position: "absolute", inset: "0" }}>
                {/* White overlay layer (z-index: 2) */}
                <div
                  ref={collageContainer2Ref}
                  style={{
                    position: "absolute",
                    inset: "0",
                    display: "grid",
                    zIndex: 2,
                  }}
                />
                {/* Photo tiles with soft-light blend (z-index: 1) */}
                <div
                  ref={collageContainerRef}
                  style={{
                    position: "absolute",
                    inset: "0",
                    display: "grid",
                    zIndex: 1,
                  }}
                />
              </div>
            </div>

            {/* Debug info */}
            <div style={{ marginTop: "1rem", color: "#9ca3af", fontSize: "0.75rem" }}>
              <div>
                Debug: Perfect Fit - Tiles created: {tiles.length} (Target: {mainImage.requestedTiles}, Optimal:{" "}
                {mainImage.actualTiles})
              </div>
              <div>Debug: Current index: {currentIndex}</div>
              <div>Debug: Total tiles: {totalTiles}</div>
              <div>
                Debug: Canvas: {mainImage.cols * mainImage.tileSize}×{mainImage.rows * mainImage.tileSize}px (100%
                coverage)
              </div>
              <div>
                Debug: Grid: {mainImage.cols}×{mainImage.rows} | Tile: {mainImage.tileSize}×{mainImage.tileSize}px
              </div>
              <div>Debug: Mosaic ready: {mosaicReady ? "Yes" : "No"}</div>
              <div>Debug: Pending photos: {pendingPhotos.length}</div>
              <div>Debug: Applied photos: {appliedPhotos.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
