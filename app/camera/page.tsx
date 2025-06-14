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
  const [pusherStatus, setPusherStatus] = useState<string>("Connecting...")
  const [showFlash, setShowFlash] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  // Add debug log function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    setDebugLogs((prev) => [...prev.slice(-9), logMessage]) // Keep last 10 logs
  }

  // Test Pusher connection on mount
  useEffect(() => {
    addDebugLog("🚀 Camera page loaded, testing Pusher connection...")
    testPusherConnection()
  }, [])

  // Test Pusher connection
  const testPusherConnection = async () => {
    try {
      addDebugLog("🔍 Testing Pusher connection with GET /api/send-photo...")
      const response = await fetch("/api/send-photo", { method: "GET" })
      addDebugLog(`📡 GET /api/send-photo response status: ${response.status}`)

      if (response.ok) {
        const data = await response.text()
        addDebugLog(`✅ Pusher connection test successful: ${data}`)
        setPusherStatus("✅ Ready to send photos")
      } else {
        addDebugLog(`❌ Pusher connection test failed with status: ${response.status}`)
        setPusherStatus("❌ Connection issue")
      }
    } catch (error) {
      addDebugLog(`❌ Pusher connection test error: ${error}`)
      setPusherStatus("❌ Connection failed")
    }
  }

  // Start camera
  const startCamera = async () => {
    try {
      addDebugLog("📹 Starting camera...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 800 }, // Reduced from 1280
          height: { ideal: 600 }, // Reduced from 720
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

  // Take photo with flash effect
  const takePhoto = () => {
    addDebugLog("📸 Starting photo capture process...")

    // Check if refs are available
    addDebugLog(
      `🔍 Checking refs - Video: ${videoRef.current ? "Available" : "NULL"}, Canvas: ${canvasRef.current ? "Available" : "NULL"}`,
    )

    if (!videoRef.current) {
      addDebugLog("❌ Video ref is null")
      alert("Video element not available. Please restart the camera.")
      return
    }

    if (!canvasRef.current) {
      addDebugLog("❌ Canvas ref is null")
      alert("Canvas element not available. Please refresh the page.")
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    // Check if video is ready
    if (video.readyState < 2) {
      addDebugLog(`❌ Video not ready. ReadyState: ${video.readyState}`)
      alert("Video is not ready yet. Please wait a moment and try again.")
      return
    }

    addDebugLog(`✅ Video ready. ReadyState: ${video.readyState}`)

    // Show flash effect
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 200)

    const context = canvas.getContext("2d")

    if (!context) {
      addDebugLog("❌ Canvas context not available")
      alert("Canvas context not available. Please refresh the page.")
      return
    }

    addDebugLog("✅ Canvas context available")

    // Set canvas dimensions - much smaller for Pusher compatibility
    const maxWidth = 400 // Reduced from 600
    const maxHeight = 300 // Reduced from 400

    let { videoWidth, videoHeight } = video
    addDebugLog(`📐 Original video dimensions: ${videoWidth}x${videoHeight}`)

    if (videoWidth === 0 || videoHeight === 0) {
      addDebugLog("❌ Video dimensions are 0. Video may not be loaded properly.")
      alert("Video dimensions are invalid. Please restart the camera.")
      return
    }

    // Scale down to smaller size for Pusher
    const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight)
    videoWidth *= ratio
    videoHeight *= ratio
    addDebugLog(`📐 Scaled video dimensions: ${videoWidth}x${videoHeight}`)

    canvas.width = videoWidth
    canvas.height = videoHeight
    addDebugLog(`📐 Canvas dimensions set to: ${canvas.width}x${canvas.height}`)

    try {
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      addDebugLog("🎨 Video frame drawn to canvas successfully")
    } catch (drawError) {
      addDebugLog(`❌ Error drawing video to canvas: ${drawError}`)
      alert("Failed to capture photo. Please try again.")
      return
    }

    try {
      // Get image data with higher compression for smaller file size
      const photoData = canvas.toDataURL("image/jpeg", 0.5) // Reduced from 0.7 to 0.5
      setPhotoTaken(true)
      setLastPhotoData(photoData)

      const dataSizeKB = Math.round(photoData.length / 1024)
      addDebugLog(`📊 Photo data created: ${photoData.length} chars, ${dataSizeKB}KB`)
      addDebugLog(`📊 Photo data prefix: ${photoData.substring(0, 50)}...`)

      // Check if photo is too large for Pusher (limit to ~50KB)
      if (dataSizeKB > 50) {
        addDebugLog(`⚠️ Photo size (${dataSizeKB}KB) may be too large for Pusher. Attempting to compress further...`)

        // Try with even higher compression
        const compressedPhotoData = canvas.toDataURL("image/jpeg", 0.3)
        const compressedSizeKB = Math.round(compressedPhotoData.length / 1024)
        addDebugLog(`📊 Compressed photo: ${compressedSizeKB}KB`)

        if (compressedSizeKB < dataSizeKB) {
          setLastPhotoData(compressedPhotoData)
          sendPhotoViaPusher(compressedPhotoData)
        } else {
          sendPhotoViaPusher(photoData)
        }
      } else {
        sendPhotoViaPusher(photoData)
      }

      console.log("📸 Photo captured:", {
        width: canvas.width,
        height: canvas.height,
        dataLength: photoData.length,
        dataSizeKB: dataSizeKB,
      })
    } catch (dataError) {
      addDebugLog(`❌ Error creating photo data: ${dataError}`)
      alert("Failed to process photo data. Please try again.")
      return
    }
  }

  // Send photo via Pusher
  const sendPhotoViaPusher = async (photoData: string) => {
    addDebugLog("🚀 Starting photo send process...")
    setIsSending(true)
    setSendingStatus("Preparing photo...")
    setLastPhotoResult(null)

    const dataSizeKB = Math.round(photoData.length / 1024)
    addDebugLog(`📦 Sending photo of size: ${dataSizeKB}KB`)

    try {
      addDebugLog("📡 Preparing POST request to /api/send-photo...")
      setSendingStatus("Sending to mosaic...")

      const requestBody = JSON.stringify({ photoData })
      addDebugLog(`📦 Request body size: ${Math.round(requestBody.length / 1024)}KB`)

      addDebugLog("📡 Making POST request to /api/send-photo...")
      const response = await fetch("/api/send-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      })

      addDebugLog(`📡 POST /api/send-photo response status: ${response.status}`)

      if (!response.ok) {
        addDebugLog("❌ Response not OK, getting error data...")
        const errorText = await response.text()
        addDebugLog(`❌ Error response text: ${errorText}`)

        let errorData
        try {
          errorData = JSON.parse(errorText)
          addDebugLog(`❌ Parsed error data: ${JSON.stringify(errorData)}`)
        } catch (parseError) {
          addDebugLog(`❌ Could not parse error response as JSON: ${parseError}`)
          errorData = { error: errorText }
        }

        // Special handling for 413 (Payload Too Large) errors
        if (response.status === 413 || errorData.details?.includes("413")) {
          addDebugLog("❌ Photo too large for Pusher. Need to compress more.")
          throw new Error(`Photo too large (${dataSizeKB}KB). Please try taking another photo.`)
        }

        throw new Error(`Server error (${response.status}): ${errorData.error || response.statusText}`)
      }

      addDebugLog("✅ Response OK, parsing result...")
      const result = await response.json()
      addDebugLog(`✅ Success response: ${JSON.stringify(result)}`)

      setSendingStatus("Photo sent to mosaic!")
      setLastPhotoResult("✅ Success: Photo sent to mosaic display!")
      addDebugLog("✅ Photo send process completed successfully")

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSendingStatus("")
      }, 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      addDebugLog(`❌ Photo send failed: ${errorMessage}`)
      console.error("❌ Error sending photo:", error)

      setSendingStatus(`Error: ${errorMessage}`)
      setLastPhotoResult(`❌ Failed: ${errorMessage}`)

      // Show detailed error in alert for debugging
      alert(
        `Failed to send photo: ${errorMessage}\n\nPhoto size: ${dataSizeKB}KB\nTip: Try taking another photo - it may compress better.`,
      )
    } finally {
      setIsSending(false)
      addDebugLog("🏁 Photo send process finished")
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
          <div className={`w-3 h-3 rounded-full ${pusherStatus.includes("✅") ? "bg-green-500" : "bg-red-500"}`}></div>
          <span className="text-sm">{pusherStatus}</span>
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
            {/* Video element - always visible when camera is active */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className={`w-full rounded-md ${!isCameraActive || photoTaken ? "hidden" : ""}`}
            ></video>

            {/* Canvas element - always present but hidden until photo is taken */}
            <canvas ref={canvasRef} className={`w-full rounded-md ${!photoTaken ? "hidden" : ""}`}></canvas>

            {/* Start camera placeholder */}
            {!isCameraActive && (
              <div className="flex justify-center items-center h-64 bg-gray-100 rounded-md">
                <Button onClick={startCamera}>Start Camera</Button>
              </div>
            )}

            {/* Flash effect overlay */}
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
              <Button onClick={() => sendPhotoViaPusher(lastPhotoData)} disabled={isSending}>
                Resend Photo
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
          <p className="mt-2">{sendingStatus || "Sending photo..."}</p>
        </div>
      )}

      {/* Photo size warning */}
      <div className="mt-4 p-4 bg-blue-50 rounded-md">
        <h3 className="font-bold mb-2 text-blue-800">📏 Photo Optimization</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Photos are automatically compressed for real-time sharing</li>
          <li>• Target size: Under 50KB for best performance</li>
          <li>• Resolution: 400x300 pixels optimized for mosaic display</li>
          <li>• If photo fails to send, try taking another - lighting affects compression</li>
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

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Camera Active: {isCameraActive ? "Yes" : "No"}</div>
        <div>Photo Taken: {photoTaken ? "Yes" : "No"}</div>
        <div>Is Sending: {isSending ? "Yes" : "No"}</div>
        <div>Pusher Status: {pusherStatus}</div>
        <div>Video Ref: {videoRef.current ? "Available" : "NULL"}</div>
        <div>Canvas Ref: {canvasRef.current ? "Available" : "NULL"}</div>
        {videoRef.current && <div>Video Ready State: {videoRef.current.readyState}</div>}
        {videoRef.current && (
          <div>
            Video Dimensions: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
          </div>
        )}
        {lastPhotoData && <div>Last Photo Size: {Math.round(lastPhotoData.length / 1024)}KB</div>}
        {lastPhotoResult && <div>Last Result: {lastPhotoResult}</div>}
      </div>
    </div>
  )
}
