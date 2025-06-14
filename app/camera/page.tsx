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

  // Start camera
  const startCamera = async () => {
    try {
      addDebugLog("📹 Starting camera...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 }, // Back to higher resolution since we're not using Pusher
          height: { ideal: 720 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
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

  // Take photo
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

    // Use higher resolution since we're uploading directly to Google Drive
    const maxWidth = 800 // Increased from 400
    const maxHeight = 600 // Increased from 300

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
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      addDebugLog("🎨 Video frame drawn to canvas successfully")

      // Higher quality since we're not limited by Pusher
      const photoData = canvas.toDataURL("image/jpeg", 0.8) // Increased from 0.5
      setPhotoTaken(true)
      setLastPhotoData(photoData)

      const dataSizeKB = Math.round(photoData.length / 1024)
      addDebugLog(`📊 Photo data created: ${dataSizeKB}KB`)

      // Upload directly to Google Drive
      uploadToGoogleDrive(photoData)
    } catch (error) {
      addDebugLog(`❌ Error in photo capture: ${error}`)
    }
  }

  // Upload to Google Drive
  const uploadToGoogleDrive = async (photoData: string) => {
    addDebugLog("🚀 Starting Google Drive upload...")
    setIsSending(true)
    setSendingStatus("Uploading to Google Drive...")
    setLastPhotoResult(null)

    const dataSizeKB = Math.round(photoData.length / 1024)
    addDebugLog(`📦 Uploading photo of size: ${dataSizeKB}KB`)

    try {
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

        throw new Error(errorData.error || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      addDebugLog(`✅ Upload successful: ${JSON.stringify(result)}`)

      setSendingStatus("Photo uploaded to Google Drive!")
      setLastPhotoResult(`✅ Success: Photo uploaded (${result.photoSize})`)

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

      <div className="flex justify-center gap-4">
        {isCameraActive && !photoTaken && (
          <Button onClick={takePhoto} disabled={isSending} size="lg" className="px-8">
            📸 Take Photo
          </Button>
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

      {/* Service Account Setup Instructions */}
      {apiStatus.includes("⚠️") && (
        <div className="mt-8 p-4 bg-orange-50 rounded-md">
          <h3 className="font-bold mb-2 text-orange-800">🔧 Service Account Setup Required</h3>
          <p className="text-sm text-orange-700 mb-2">
            To enable direct Google Drive uploads without sign-in, set up these environment variables:
          </p>
          <ul className="text-xs text-orange-600 space-y-1 font-mono">
            <li>• GOOGLE_PROJECT_ID</li>
            <li>• GOOGLE_PRIVATE_KEY</li>
            <li>• GOOGLE_CLIENT_EMAIL</li>
            <li>• GOOGLE_DRIVE_FOLDER_ID (optional)</li>
          </ul>
        </div>
      )}

      {/* Benefits */}
      <div className="mt-4 p-4 bg-green-50 rounded-md">
        <h3 className="font-bold mb-2 text-green-800">🚀 Direct Google Drive Upload</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• ✅ No sign-in required for camera users</li>
          <li>• 📸 Higher quality photos (800x600, 80% quality)</li>
          <li>• 💾 Direct upload to Google Drive</li>
          <li>• 🔄 Photos appear on main mosaic automatically</li>
          <li>• 📱 No file size limitations like Pusher</li>
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
