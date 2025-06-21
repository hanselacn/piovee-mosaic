"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
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

export default function PreviewPage() {
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
    tileSize: 20,
    totalTiles: 0,
    currentIndex: 0,
    tileOrder: [],
  })
  const [mosaicReady, setMosaicReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Refs for DOM elements
  const mosaicRef = useRef<HTMLDivElement>(null)
  const photoLayerRef = useRef<HTMLDivElement>(null)
  const whiteLayerRef = useRef<HTMLDivElement>(null)

  // Fetch all unused photos from Firestore
  const fetchPhotos = useCallback(async () => {
    try {
      console.log('Fetching unused photos from Firestore...');
      const res = await fetch('/api/mosaic-photos?used=false');
      const data = await res.json();
      console.log(`Fetched ${data.photos?.length || 0} unused photos:`, data.photos?.map((p: any) => p.id));
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Error fetching photos:', err);
      setError('Failed to fetch photos from Firestore');
    }
  }, []);

  // On mount, fetch photos
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // On Pusher event, fetch photos again
  const handleNewPhoto = useCallback(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Process photo queue efficiently: take one photo, collage it, mark as used, repeat
  useEffect(() => {
    if (!mosaicReady) return;
    if (photos.length === 0) return;
    if (mosaicState.currentIndex >= mosaicState.totalTiles) return;
    if (isProcessing) return; // Prevent processing if already processing

    // Take the first unused photo from the queue
    const nextPhoto = photos[0];
    if (!nextPhoto) return;

    console.log(`Processing photo ${nextPhoto.id} (${photos.length} photos in queue)`);
    setIsProcessing(true);

    // Pick a truly random available tile instead of sequential
    const availableTiles = mosaicState.tileOrder.slice(mosaicState.currentIndex);
    const randomIndex = Math.floor(Math.random() * availableTiles.length);
    const tileIndex = availableTiles[randomIndex];
    
    // Swap the selected tile to the current position to mark it as used
    const newTileOrder = [...mosaicState.tileOrder];
    const currentPos = mosaicState.currentIndex;
    const selectedPos = currentPos + randomIndex;
    [newTileOrder[currentPos], newTileOrder[selectedPos]] = [newTileOrder[selectedPos], newTileOrder[currentPos]];
    
    // Collage the photo to the mosaic
    if (photoLayerRef.current && whiteLayerRef.current) {
      const photoTile = photoLayerRef.current.children[tileIndex] as HTMLElement;
      const whiteTile = whiteLayerRef.current.children[tileIndex] as HTMLElement;
      
      if (photoTile && whiteTile) {
        photoTile.style.backgroundImage = `url('${nextPhoto.photoData}')`;
        photoTile.style.opacity = "1";
        
        setTimeout(() => {
          whiteTile.style.opacity = "0";
          whiteTile.style.transform = "scale(0.8)";
        }, 50);
      }
    }

    // Update mosaic state with new tile order and incremented index
    setMosaicState(prev => ({ 
      ...prev, 
      currentIndex: prev.currentIndex + 1,
      tileOrder: newTileOrder
    }));

    // Mark photo as used in Firestore (remove from queue)
    console.log(`Marking photo ${nextPhoto.id} as used and saving tile position ${tileIndex}...`);
    fetch('/api/mosaic-photos', {
      method: 'PATCH',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nextPhoto.id, tileIndex }),
    }).then(() => {
      console.log(`Photo ${nextPhoto.id} marked as used, removing from local queue`);
      // Remove photo from local state to trigger next photo processing
      setPhotos(prev => prev.slice(1));
      setIsProcessing(false); // Allow next photo to be processed
    }).catch(err => {
      console.error('Failed to mark photo as used:', err);
      setIsProcessing(false); // Allow retry
    });

  }, [photos, mosaicReady, mosaicState.currentIndex, mosaicState.totalTiles, mosaicState.tileOrder, isProcessing])
  // Create mosaic grid optimized for fullscreen
  const createMosaic = useCallback(async () => {
    if (!mainImage || !mosaicRef.current || !photoLayerRef.current || !whiteLayerRef.current) return

    const img = new Image()
    img.src = mainImage

    await new Promise((resolve) => {
      img.onload = resolve
    })

    const aspectRatio = img.width / img.height
    
    // Use saved grid configuration or calculate for fullscreen
    let cols, rows, tileSize, totalTiles
    
    if (mosaicState.cols && mosaicState.rows && mosaicState.tileSize) {
      // Use saved grid configuration
      cols = mosaicState.cols
      rows = mosaicState.rows
      tileSize = mosaicState.tileSize
      totalTiles = mosaicState.totalTiles
      console.log(`Using saved grid config: ${cols}x${rows} (${tileSize}px tiles)`)    } else {
      // Calculate new grid configuration for fullscreen
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      
      // Use larger dimensions - aim for 80% of screen size
      const maxWidth = screenWidth * 0.9
      const maxHeight = screenHeight * 0.8
      
      // Calculate container dimensions to match main image aspect ratio
      let containerWidth, containerHeight
      
      if (aspectRatio > maxWidth / maxHeight) {
        // Image is wider than available ratio - fit to width
        containerWidth = maxWidth
        containerHeight = Math.round(containerWidth / aspectRatio)
      } else {
        // Image is taller than available ratio - fit to height
        containerHeight = maxHeight
        containerWidth = Math.round(containerHeight * aspectRatio)
      }
      
      tileSize = mosaicState.tileSize || 20
      cols = Math.ceil(containerWidth / tileSize)
      rows = Math.ceil(containerHeight / tileSize)
      totalTiles = cols * rows
      console.log(`Calculated fullscreen grid: ${cols}x${rows} (${tileSize}px tiles) for ${containerWidth}x${containerHeight}px`)
    }
    
    // Calculate container dimensions based on grid
    const containerWidth = cols * tileSize
    const containerHeight = rows * tileSize
    
    // Center the container on screen
    mosaicRef.current.style.width = `${containerWidth}px`
    mosaicRef.current.style.height = `${containerHeight}px`
    mosaicRef.current.style.left = `${(window.innerWidth - containerWidth) / 2}px`
    mosaicRef.current.style.top = `${(window.innerHeight - containerHeight) / 2}px`

    // Generate randomized tile order if not already set
    let tileOrder = mosaicState.tileOrder
    if (!tileOrder || tileOrder.length !== totalTiles) {
      tileOrder = Array.from({ length: totalTiles }, (_, i) => i)
      for (let i = tileOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tileOrder[i], tileOrder[j]] = [tileOrder[j], tileOrder[i]]
      }
    }

    // Update mosaic state
    setMosaicState(prev => ({
      ...prev,
      cols,
      rows,
      totalTiles,
      tileOrder,
      tileSize
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
  }, [mainImage, mosaicState.tileSize, mosaicState.cols, mosaicState.rows, mosaicState.totalTiles, mosaicState.tileOrder])

  // Load main image and grid configuration
  const loadMainImage = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/main-image")
      const data = await response.json()

      if (data.mainImage?.dataUrl) {
        setMainImage(data.mainImage.dataUrl)
        
        // Load grid configuration from Firestore
        if (data.mainImage.gridConfig) {
          console.log("Loading grid config from Firestore:", data.mainImage.gridConfig)
          setMosaicState(prev => ({
            ...prev,
            ...data.mainImage.gridConfig,
            currentIndex: 0 // Reset index when loading new config
          }))
        }
      }
    } catch (err) {
      setError("Failed to load main image")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Restore mosaic state from Firestore
  const restoreMosaicState = useCallback(async () => {
    if (!mosaicReady || !photoLayerRef.current || !whiteLayerRef.current) return

    try {
      console.log('Restoring mosaic state from Firestore...')
      
      // Fetch all used photos with their tile positions
      const response = await fetch('/api/mosaic-photos?used=true')
      const data = await response.json()
      const usedPhotos = data.photos || []
      
      console.log(`Found ${usedPhotos.length} used photos to restore`)
      
      if (usedPhotos.length === 0) return

      // Sort by timestamp to restore in order
      usedPhotos.sort((a: PhotoData, b: PhotoData) => a.timestamp - b.timestamp)
      
      let restoredCount = 0
      
      for (const photo of usedPhotos) {
        if (photo.tileIndex !== undefined && photo.tileIndex !== null && photo.tileIndex < mosaicState.totalTiles) {
          const photoTile = photoLayerRef.current.children[photo.tileIndex] as HTMLElement
          const whiteTile = whiteLayerRef.current.children[photo.tileIndex] as HTMLElement
          
          if (photoTile && whiteTile) {
            // Restore the photo to its saved tile position
            photoTile.style.backgroundImage = `url('${photo.photoData}')`
            photoTile.style.opacity = "1"
            whiteTile.style.opacity = "0"
            whiteTile.style.transform = "scale(0.8)"
            restoredCount++
          }
        }
      }
      
      // Update the current index to reflect how many tiles are occupied
      setMosaicState(prev => ({
        ...prev,
        currentIndex: restoredCount
      }))
      
      console.log(`✅ Restored ${restoredCount} photos to their tile positions`)
      setStatus(`✅ Restored ${restoredCount} photos from previous session`)
      setTimeout(() => setStatus(""), 3000)
      
    } catch (error) {
      console.error('Error restoring mosaic state:', error)
      setStatus('❌ Failed to restore previous mosaic state')
      setTimeout(() => setStatus(""), 3000)
    }
  }, [mosaicReady, mosaicState.totalTiles])

  // Effect: Load main image on mount
  useEffect(() => {
    loadMainImage()
  }, [])

  // Effect: Create mosaic when main image is loaded
  useEffect(() => {
    if (mainImage && mosaicRef.current) {
      console.log("Creating fullscreen mosaic from main image")
      createMosaic()
    }
  }, [mainImage, createMosaic])

  // Effect: Restore mosaic state when mosaic becomes ready
  useEffect(() => {
    if (mosaicReady) {
      console.log("Mosaic is ready, restoring state from Firestore")
      restoreMosaicState()
    }
  }, [mosaicReady, restoreMosaicState])

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

    const unsubscribe = subscribeToPusherChannel(
      pusher,
      "camera-channel",
      "photo-uploaded",
      () => {
        try {
          console.log("Received photo notification, refreshing queue...");
          setStatus("New photo detected, updating queue...");
          handleNewPhoto();
          setStatus("✅ Photo queue updated");
          setTimeout(() => setStatus(""), 3000);
        } catch (err) {
          console.error("Error handling photo notification:", err);
          setStatus("❌ Failed to update queue");
          setTimeout(() => setStatus(""), 3000);
        }
      }
    )

    return () => {
      console.log("Cleaning up Pusher subscription")
      unsubscribe?.()
    }
  }, [mosaicReady, handleNewPhoto])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mainImage) {
        createMosaic()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mainImage, createMosaic])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-white">Loading Mosaic Preview</h2>
          <p className="text-gray-400">Please wait while we set up your fullscreen mosaic...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // No main image state
  if (!mainImage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">No Mosaic Available</h2>
          <p className="text-gray-400 mb-8">Upload a main image to start creating your mosaic</p>
          <Button asChild>
            <Link href="/upload">Upload Main Image</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Fullscreen mosaic display
  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Top overlay with controls and info */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start">
        <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-md">
          <div className="text-lg font-bold">Live Mosaic Preview</div>
          <div className="text-sm opacity-80">
            Photos: {mosaicState.currentIndex}/{mosaicState.totalTiles} | 
            Grid: {mosaicState.cols}×{mosaicState.rows} | 
            Tile: {mosaicState.tileSize}px
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/camera">Add Photos</Link>
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute top-20 left-4 right-4 z-10">
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-300 ease-out"
            style={{
              width: `${(mosaicState.currentIndex / mosaicState.totalTiles) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className="absolute top-24 left-4 right-4 z-10">
          <Alert className="bg-black bg-opacity-50 border-gray-600">
            <AlertDescription className="text-white">{status}</AlertDescription>
          </Alert>
        </div>
      )}      {/* Fullscreen mosaic display */}
      <div
        ref={mosaicRef}
        className="absolute bg-black"
        style={{ position: 'absolute' }}
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
    </div>
  )
}
