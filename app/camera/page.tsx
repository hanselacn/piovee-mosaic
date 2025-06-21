"use client"

import { useEffect, useRef, useState } from "react"

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  const maxPhotos = 10
  const [filter, setFilter] = useState("none")
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user") // user = front, environment = back
  const [debugInfo, setDebugInfo] = useState<string>("")
  const startCamera = async (facing: "user" | "environment") => {
    if (!videoRef.current) return

    try {
      setDebugInfo("Checking camera availability...")
      
      // Stop existing stream if any
      const currentStream = videoRef.current.srcObject as MediaStream
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }

      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser or mode")
      }

      setDebugInfo(`Requesting ${facing} camera...`)

      // Request new camera stream with fallback options
      let stream: MediaStream
      try {
        // Try with specific facing mode first
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facing }
        })
      } catch (facingError) {
        console.warn(`Failed to use ${facing} camera, trying any camera:`, facingError)
        setDebugInfo("Falling back to any available camera...")
        // Fallback to any available camera
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true
        })
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setDebugInfo("Camera started successfully!")
        setTimeout(() => setDebugInfo(""), 3000)
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown camera error"
      setDebugInfo(`Camera error: ${errorMessage}`)
      alert(`Camera access failed: ${errorMessage}. Please allow camera permissions and refresh the page.`)
    }
  }
  useEffect(() => {
    startCamera(facingMode)
    
    // Check for incognito mode indicators
    if (typeof window !== 'undefined') {
      const isIncognito = !window.localStorage || !navigator.serviceWorker
      if (isIncognito) {
        setDebugInfo("Incognito mode detected - some features may be limited")
      }
    }
  }, [facingMode])

  const capturePhoto = async () => {
    if (photoCount >= maxPhotos) {
      alert("You've reached your 10-photo limit.")
      return
    }

    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.filter = filter
    
    // If using front camera, flip the image back to normal for saving
    if (facingMode === "user") {
      ctx.scale(-1, 1)
      ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height)
    } else {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    }
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
    setPhotos((prev) => [...prev, dataUrl]);    try {
      setDebugInfo(`Uploading photo ${photoCount + 1}...`)
      console.log(`Uploading photo ${photoCount + 1} to mosaic queue...`);
      
      // Upload photo to mosaic queue (will store in Google Drive + Firestore metadata)
      const mosaicRes = await fetch("/api/mosaic-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoData: dataUrl,
          fileName: `camera-photo-${Date.now()}.jpg`,
          timestamp: Date.now(),
        }),
      });
      
      if (!mosaicRes.ok) {
        const errorData = await mosaicRes.json().catch(() => ({ error: "Unknown server error" }));
        console.error("Mosaic upload failed:", errorData);
        throw new Error(errorData.error || `Failed to upload photo to mosaic queue (${mosaicRes.status})`);
      }

      setDebugInfo("Triggering live update...")
      console.log("Photo uploaded to mosaic queue, triggering Pusher event...");
      
      // Trigger Pusher event to notify main page
      try {
        await fetch("/api/test-pusher", { method: "POST" });
      } catch (pusherError) {
        console.warn("Pusher notification failed, but photo was uploaded:", pusherError);
      }
      
      setPhotoCount((prev) => prev + 1);
      setDebugInfo("Photo uploaded successfully!")
      setTimeout(() => setDebugInfo(""), 3000)
      console.log("Photo uploaded to mosaic queue and Pusher triggered successfully");
    } catch (error) {
      console.error("Error uploading photo:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error";
      setDebugInfo(`Upload failed: ${errorMessage}`)
      alert(`Failed to upload photo: ${errorMessage}. Please check your connection and try again.`);
    }}

  const handleFilterChange = (filterValue: string) => {
    setFilter(filterValue)
  }

  const flipCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user")
  }
  
  return (
    <div className="relative min-h-screen w-full bg-[#fefaf7] text-[#5e4b44]">
      <header className="pt-6 pb-2 text-center">
        <h1 className="font-[Cormorant_Garamond] text-4xl text-[#7a645f]">
          Piovee Camera
        </h1>        <div className="font-[DM_Sans] text-sm text-[#a0918a]">
          Your wedding POV. One click at a time.
        </div>
        {debugInfo && (
          <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-md">
            {debugInfo}
          </div>
        )}
      </header>

      <main className="flex flex-col items-center px-4 pb-6">        <div className="camera-frame mt-4 w-full max-w-[390px] aspect-[3/4] bg-black rounded-[32px] shadow-lg overflow-hidden relative">          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ 
              filter, 
              transform: facingMode === "user" ? 'scaleX(-1)' : 'none' 
            }}
            className="w-full h-full object-cover"
          />
          <div className="overlay absolute inset-0 pointer-events-none border-[20px] border-white/5 rounded-[32px]" />
        </div>

        <div className="filter-selector mt-4 flex gap-3">
          <button
            onClick={() => handleFilterChange("none")}
            className="font-[DM_Sans] bg-[#f1e8e2] rounded-lg px-3 py-2 text-sm text-[#5e4b44]"
          >
            Normal
          </button>
          <button
            onClick={() => handleFilterChange("grayscale(100%)")}
            className="font-[DM_Sans] bg-[#f1e8e2] rounded-lg px-3 py-2 text-sm text-[#5e4b44]"
          >
            Greyscale
          </button>
          <button
            onClick={() =>
              handleFilterChange(
                "contrast(110%) brightness(105%) sepia(8%) hue-rotate(2deg)"
              )
            }
            className="font-[DM_Sans] bg-[#f1e8e2] rounded-lg px-3 py-2 text-sm text-[#5e4b44]"
          >
            Analog
          </button>
        </div>        <div className="flex items-center justify-center gap-6 mt-6 mb-4">
          <button
            onClick={capturePhoto}
            className="shutter w-[72px] h-[72px] rounded-full border-[6px] border-[#e6d5ce] bg-white shadow-lg"
            aria-label="Take photo"
          />
            <button
            onClick={flipCamera}
            className="w-[48px] h-[48px] rounded-full bg-[#f1e8e2] border-2 border-[#e6d5ce] shadow-md flex items-center justify-center"
            aria-label="Flip camera"
          >            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              className="text-[#5e4b44]"
            >
              <path 
                d="M23 4v6h-6M1 20v-6h6" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="photos flex flex-wrap justify-center gap-3 p-4">
          {photos.map((photo, index) => (
            <img
              key={index}
              src={photo}
              alt={`Captured photo ${index + 1}`}
              className="w-[72px] h-[100px] object-cover rounded-xl border border-[#e9e0dc]"
            />
          ))}
        </div>

        <footer className="font-[DM_Sans] text-xs text-[#b4a6a0] mb-4">
          You can take up to {maxPhotos} photos — no retakes.
        </footer>
      </main>
    </div>
  )
}
