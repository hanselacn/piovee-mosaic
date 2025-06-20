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
    tileSize: 20, // Smaller tiles for more detailed mosaic
    totalTiles: 0,
    currentIndex: 0,    tileOrder: [],
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
  }, [fetchPhotos]);  // Process photo queue efficiently: take one photo, collage it, mark as used, repeat
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
    console.log(`Marking photo ${nextPhoto.id} as used...`);
    fetch('/api/mosaic-photos', {
      method: 'PATCH',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: nextPhoto.id }),
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
    
    // Calculate container dimensions to match main image aspect ratio
    const containerWidth = mosaicRef.current.clientWidth
    const containerHeight = Math.round(containerWidth / aspectRatio)
    
    // Set container height to match main image aspect ratio
    mosaicRef.current.style.height = `${containerHeight}px`
    
    // Calculate grid size based on container dimensions
    const cols = Math.floor(containerWidth / tileSize)
    const rows = Math.floor(containerHeight / tileSize)
    const totalTiles = cols * rows

    console.log(`Creating mosaic: ${cols}x${rows} grid (${totalTiles} tiles) for ${containerWidth}x${containerHeight}px container`)

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
          () => {
            try {
              console.log("Received photo notification, refreshing queue...");
              setStatus("New photo detected, updating queue...");
              handleNewPhoto(); // This will fetch the latest queue from Firestore
              setStatus("✅ Photo queue updated");
              setTimeout(() => setStatus(""), 3000);
            } catch (err) {
              console.error("Error handling photo notification:", err);
              setStatus("❌ Failed to update queue");
              setTimeout(() => setStatus(""), 3000);
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
    }  }, [mosaicReady, handleNewPhoto])

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
          )}          {/* Mosaic display */}
          <div
            ref={mosaicRef}
            className="relative w-full bg-gray-800 rounded-lg overflow-hidden"
            style={{ minHeight: '400px' }}
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
