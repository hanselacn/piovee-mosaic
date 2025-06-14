"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [photoTaken, setPhotoTaken] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [lastPhotoResult, setLastPhotoResult] = useState<string | null>(null)
  const [sendingStatus, setSendingStatus] = useState<string>("")
  const [lastPhotoData, setLastPhotoData] = useState<string>("")
  const [apiStatus, setApiStatus] = useState<string>("Checking...")
  const [showFlash, setShowFlash] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  // Add debug log function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLogs((prev) => [...prev.slice(-9), logMessage]) // Keep last 10 logs
  }

  // Test API connection on mount
  useEffect(() => {
    addDebugLog("🚀 Camera page loaded, testing upload API...")
    testUploadAPI()
  }, [])

  // Test upload API
  const testUploadAPI = async () => {
    try {
      addDebugLog("🔍 Testing upload API with GET /api/upload-photo...")
      const response = await fetch("/api/upload-photo", { method: "GET" })
      addDebugLog(`📡 GET /api/upload-photo response status: ${response.status}`)

      if (response.ok) {
        const data = await response.json()
        addDebugLog(`✅ API test successful: ${JSON.stringify(data)}`)

        if (data.serviceAccountConfigured) {
          setApiStatus("✅ Ready for direct Google Drive upload")
        } else {
          setApiStatus("⚠️ Service account not configured")
        }
      } else {
        addDebugLog(`❌ API test failed with status: ${response.status}`)
        setApiStatus("❌ API connection issue")
      }
    } catch (error) {
      addDebugLog(`❌ API test error: ${error}`)
      setApiStatus("❌ API connection failed")
    }
  }

  // Start camera with iPhone-specific settings
  const startCamera = async () => {
    try {
      addDebugLog("📹 Starting camera...")

      // iPhone-specific camera constraints
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          // iPhone-specific settings
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      }

      addDebugLog(`📹 Camera constraints: ${JSON.stringify(constraints)}`)

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // iPhone-specific video settings
        videoRef.current.setAttribute("playsinline", "true")
        videoRef.current.setAttribute("webkit-playsinline", "true")

        setIsCameraActive(true)
        addDebugLog("✅ Camera started successfully")

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          addDebugLog(`📹 Video metadata loaded: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`)
        }
      } else {
        addDebugLog("❌ Video ref is null")
      }
    } catch (error) {
      addDebugLog(`❌ Camera start error: ${error}`)
      console.error("Error accessing camera:", error)
      alert("Error accessing camera. Please make sure you have granted camera permissions.")
    }
  }

  // Stop camera
  const stopCamera = () => {
    addDebugLog("🛑 Stopping camera...")
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()

      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
      addDebugLog("✅ Camera stopped successfully")
    }
  }

  // Take photo with iPhone-specific handling
  const takePhoto = () => {
    addDebugLog("📸 Starting photo capture process...")

    if (!videoRef.current || !canvasRef.current) {
      addDebugLog("❌ Video or canvas ref not available")
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.readyState < 2) {
      addDebugLog(`❌ Video not ready. ReadyState: ${video.readyState}`)
      alert("Video is not ready yet. Please wait a moment and try again.")
      return
    }

    // Show flash effect
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 200)

    const context = canvas.getContext("2d")
    if (!context) {
      addDebugLog("❌ Canvas context not available")
      return
    }

    // iPhone-optimized resolution
    const maxWidth = 800
    const maxHeight = 600

    let { videoWidth, videoHeight } = video
    addDebugLog(`📐 Original video dimensions: ${videoWidth}x${videoHeight}`)

    if (videoWidth === 0 || videoHeight === 0) {
      addDebugLog("❌ Video dimensions are 0")
      return
    }

    // Scale down if needed
    if (videoWidth > maxWidth || videoHeight > maxHeight) {
      const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight)
      videoWidth *= ratio
      videoHeight *= ratio
      addDebugLog(`📐 Scaled video dimensions: ${videoWidth}x${videoHeight}`)
    }

    canvas.width = videoWidth
    canvas.height = videoHeight

    try {
      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height)

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      addDebugLog("🎨 Video frame drawn to canvas successfully")

      // Convert to base64 with iPhone-compatible settings
      const photoData = canvas.toDataURL("image/jpeg", 0.8)

      // Validate base64 data
      if (!photoData || !photoData.startsWith("data:image/jpeg;base64,")) {
        addDebugLog("❌ Invalid photo data format")
        alert("Failed to capture photo. Please try again.")
        return
      }

      setPhotoTaken(true)
      setLastPhotoData(photoData)

      const dataSizeKB = Math.round(photoData.length / 1024)
      addDebugLog(`📊 Photo data created: ${dataSizeKB}KB`)

      // Validate base64 content
      const base64Content = photoData.split(",")[1]
      if (!base64Content || base64Content.length < 100) {
        addDebugLog("❌ Base64 content too short or invalid")
        alert("Photo capture failed. Please try again.")
        return
      }

      addDebugLog(`✅ Base64 validation passed: ${base64Content.length} characters`)

      // Upload directly to Google Drive
      uploadToGoogleDrive(photoData)
    } catch (error) {
      addDebugLog(`❌ Error in photo capture: ${error}`)
      alert("Photo capture failed. Please try again.")
    }
  }

  // Upload to Google Drive with enhanced error handling
  const uploadToGoogleDrive = async (photoData: string) => {
    addDebugLog("🚀 Starting Google Drive upload...")
    setIsSending(true)
    setSendingStatus("Uploading to Google Drive...")
    setLastPhotoResult(null)

    const dataSizeKB = Math.round(photoData.length / 1024)
    addDebugLog(`📦 Uploading photo of size: ${dataSizeKB}KB`)

    try {
      // Validate photo data before sending
      if (!photoData.startsWith("data:image/jpeg;base64,")) {
        throw new Error("Invalid photo data format")
      }

      const base64Content = photoData.split(",")[1]
      if (!base64Content || base64Content.length < 100) {
        throw new Error("Photo data is too short or corrupted")
      }

      // Test base64 validity
      try {
        atob(base64Content.substring(0, 100)) // Test decode first 100 chars
        addDebugLog("✅ Base64 format validation passed")
      } catch (decodeError) {
        throw new Error("Invalid base64 encoding")
      }

      addDebugLog("📡 Sending POST request to /api/upload-photo...")

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoData }),
      })

      addDebugLog(`📡 Upload response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json()
        addDebugLog(`❌ Upload failed: ${JSON.stringify(errorData)}`)

        if (errorData.requiresAuth) {
          throw new Error("Service account not configured. Please set up Google Service Account.")
        }

        throw new Error(errorData.details || errorData.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      addDebugLog(`✅ Upload successful: ${JSON.stringify(result)}`)

      setSendingStatus("Photo uploaded to Google Drive!")
      setLastPhotoResult(`✅ Success: Photo uploaded (${result.photoSize || dataSizeKB + "KB"})`)

      setTimeout(() => setSendingStatus(""), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      addDebugLog(`❌ Upload failed: ${errorMessage}`)

      setSendingStatus(`Error: ${errorMessage}`)
      setLastPhotoResult(`❌ Failed: ${errorMessage}`)
    } finally {
      setIsSending(false)
    }
  }

  // Reset photo
  const resetPhoto = () => {
    addDebugLog("🔄 Resetting photo...")
    setPhotoTaken(false)
    setLastPhotoResult(null)
    setSendingStatus("")
    setLastPhotoData("")
  }

  // Flip camera (front/back)
  const flipCamera = () => {
    addDebugLog("🔄 Flipping camera...")
    stopCamera()
    setFacingMode(facingMode === "environment" ? "user" : "environment")
    setTimeout(() => {
      startCamera()
    }, 500)
  }

  // Clear debug logs
  const clearDebugLogs = () => {
    setDebugLogs([])
    addDebugLog("🧹 Debug logs cleared")
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Camera</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${apiStatus.includes("✅") ? "bg-green-500" : apiStatus.includes("⚠️") ? "bg-yellow-500" : "bg-red-500"}`}
          ></div>
          <span className="text-sm">{apiStatus}</span>
        </div>

        <Link href="/">
          <Button variant="outline">Back to Mosaic</Button>
        </Link>
      </div>

      {/* Status display */}
      {sendingStatus && (
        <div
          className={`mb-4 p-3 rounded ${
            sendingStatus.includes("Error") || sendingStatus.includes("Failed")
              ? "bg-red-100 border border-red-400 text-red-700"
              : sendingStatus.includes("Success") || sendingStatus.includes("✅")
                ? "bg-green-100 border border-green-400 text-green-700"
                : "bg-blue-100 border border-blue-400 text-blue-700"
          }`}
        >
          <strong>Status:</strong> {sendingStatus}
        </div>
      )}

      {/* Last photo result */}
      {lastPhotoResult && (
        <div
          className={`mb-4 p-3 rounded ${
            lastPhotoResult.includes("Failed") || lastPhotoResult.includes("❌")
              ? "bg-red-100 border border-red-400 text-red-700"
              : "bg-green-100 border border-green-400 text-green-700"
          }`}
        >
          {lastPhotoResult}
        </div>
      )}

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              webkit-playsinline="true"
              className={`w-full rounded-md ${!isCameraActive || photoTaken ? "hidden" : ""}`}
            ></video>

            <canvas ref={canvasRef} className={`w-full rounded-md ${!photoTaken ? "hidden" : ""}`}></canvas>

            {!isCameraActive && (
              <div className="flex justify-center items-center h-64 bg-gray-100 rounded-md">
                <Button onClick={startCamera}>Start Camera</Button>
              </div>
            )}

            {showFlash && <div className="absolute inset-0 bg-white rounded-md animate-pulse opacity-80"></div>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4 flex-wrap">
        {isCameraActive && !photoTaken && (
          <>
            <Button onClick={takePhoto} disabled={isSending} size="lg" className="px-8">
              📸 Take Photo
            </Button>
            <Button onClick={flipCamera} disabled={isSending} variant="outline">
              🔄 Flip Camera
            </Button>
          </>
        )}

        {photoTaken && (
          <>
            <Button onClick={resetPhoto} disabled={isSending}>
              Take Another
            </Button>
            <Button variant="outline" onClick={stopCamera} disabled={isSending}>
              Close Camera
            </Button>
            {lastPhotoData && (
              <Button onClick={() => uploadToGoogleDrive(lastPhotoData)} disabled={isSending}>
                Retry Upload
              </Button>
            )}
          </>
        )}

        {isCameraActive && !photoTaken && (
          <Button variant="outline" onClick={stopCamera}>
            Close Camera
          </Button>
        )}
      </div>

      {isSending && (
        <div className="text-center mt-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2">{sendingStatus || "Uploading photo..."}</p>
        </div>
      )}

      {/* iPhone-specific info */}
      <div className="mt-4 p-4 bg-blue-50 rounded-md">
        <h3 className="font-bold mb-2 text-blue-800">📱 iPhone Camera Features</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 🔄 Flip Camera: Switch between front and back camera</li>
          <li>• 📸 Optimized for iPhone: Enhanced base64 validation</li>
          <li>• 🎯 Auto-focus: Tap screen to focus (if supported)</li>
          <li>• 📐 Smart sizing: Automatically optimizes photo size</li>
        </ul>
      </div>

      {/* Debug Logs */}
      <div className="mt-4 p-4 bg-yellow-50 rounded-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-yellow-800">🐛 Debug Logs</h3>
          <Button onClick={clearDebugLogs} variant="outline" size="sm">
            Clear Logs
          </Button>
        </div>
        <div className="text-xs text-yellow-700 space-y-1 max-h-40 overflow-y-auto">
          {debugLogs.length === 0 ? (
            <div>No logs yet...</div>
          ) : (
            debugLogs.map((log, index) => (
              <div key={index} className="font-mono">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
