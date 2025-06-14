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
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [lastPhotoResult, setLastPhotoResult] = useState<string | null>(null)
  const [sendingStatus, setSendingStatus] = useState<string>("")
  const [lastPhotoData, setLastPhotoData] = useState<string>("")
  const shutterSound = useRef<HTMLAudioElement | null>(null)

  // Initialize shutter sound
  useEffect(() => {
    shutterSound.current = new Audio("/camera-shutter.mp3")
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("Error accessing camera. Please make sure you have granted camera permissions.")
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()

      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsCameraActive(false)
    }
  }

  // Take photo with countdown
  const takePhotoWithCountdown = () => {
    setCountdown(3)

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          takePhoto()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Take photo
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    // Set canvas dimensions to match video (but limit size for better performance)
    const maxWidth = 800
    const maxHeight = 600

    let { videoWidth, videoHeight } = video

    // Scale down if too large
    if (videoWidth > maxWidth || videoHeight > maxHeight) {
      const ratio = Math.min(maxWidth / videoWidth, maxHeight / videoHeight)
      videoWidth *= ratio
      videoHeight *= ratio
    }

    canvas.width = videoWidth
    canvas.height = videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Play shutter sound
    if (shutterSound.current) {
      shutterSound.current.play().catch((e) => console.error("Error playing sound:", e))
    }

    // Get image data with higher compression for smaller file size
    const photoData = canvas.toDataURL("image/jpeg", 0.6)
    setPhotoTaken(true)
    setLastPhotoData(photoData)

    console.log("📸 Photo captured:", {
      width: canvas.width,
      height: canvas.height,
      dataLength: photoData.length,
      dataSizeKB: Math.round(photoData.length / 1024),
    })

    // Send photo to server (no authentication required)
    sendPhotoToServer(photoData)
  }

  // Send photo to server
  const sendPhotoToServer = async (photoData: string) => {
    setIsSending(true)
    setSendingStatus("Preparing photo...")
    setLastPhotoResult(null)

    try {
      console.log("📡 Sending photo to server...")
      console.log("📡 Photo data size:", Math.round(photoData.length / 1024), "KB")
      setSendingStatus("Uploading photo...")

      const response = await fetch("/api/collage-photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoData }),
      })

      console.log("📡 Server response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ Server error response:", errorData)
        throw new Error(`Server error (${response.status}): ${errorData.error || response.statusText}`)
      }

      const result = await response.json()
      console.log("✅ Photo uploaded successfully:", result)

      setSendingStatus("Photo uploaded successfully!")
      setLastPhotoResult("✅ Success: Photo added to mosaic!")

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSendingStatus("")
      }, 3000)
    } catch (error) {
      console.error("❌ Error uploading photo:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setSendingStatus(`Error: ${errorMessage}`)
      setLastPhotoResult(`❌ Failed: ${errorMessage}`)

      // Show detailed error in alert for debugging
      alert(
        `Failed to upload photo: ${errorMessage}\n\nPhoto size: ${Math.round(photoData.length / 1024)}KB\nCheck console for more details.`,
      )
    } finally {
      setIsSending(false)
    }
  }

  // Reset photo
  const resetPhoto = () => {
    setPhotoTaken(false)
    setLastPhotoResult(null)
    setSendingStatus("")
    setLastPhotoData("")
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
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>No Sign-In Required</span>
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
            {!photoTaken ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full rounded-md ${!isCameraActive ? "hidden" : ""}`}
                ></video>

                {!isCameraActive && (
                  <div className="flex justify-center items-center h-64 bg-gray-100 rounded-md">
                    <Button onClick={startCamera}>Start Camera</Button>
                  </div>
                )}

                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md">
                    <span className="text-white text-7xl font-bold">{countdown}</span>
                  </div>
                )}
              </>
            ) : (
              <canvas ref={canvasRef} className="w-full rounded-md"></canvas>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        {isCameraActive && !photoTaken && (
          <Button onClick={takePhotoWithCountdown} disabled={countdown > 0 || isSending}>
            {countdown > 0 ? `Taking in ${countdown}...` : "Take Photo"}
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
              <Button onClick={() => sendPhotoToServer(lastPhotoData)} disabled={isSending}>
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

      {/* Instructions */}
      <div className="mt-8 p-4 bg-green-50 rounded-md">
        <h3 className="font-bold mb-2 text-green-800">📱 Easy Photo Taking</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• ✅ No sign-in required on this device</li>
          <li>• 📸 Just take photos and they'll be added to the mosaic</li>
          <li>• 🔄 Photos appear automatically on the main page</li>
          <li>• 📱 Share this camera link with anyone to contribute photos</li>
        </ul>
      </div>

      {/* Debug info */}
      <div className="mt-4 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Status Information</h3>
        <div>Camera Active: {isCameraActive ? "Yes" : "No"}</div>
        <div>Photo Taken: {photoTaken ? "Yes" : "No"}</div>
        <div>Is Sending: {isSending ? "Yes" : "No"}</div>
        {lastPhotoData && <div>Last Photo Size: {Math.round(lastPhotoData.length / 1024)}KB</div>}
        {lastPhotoResult && <div>Last Result: {lastPhotoResult}</div>}
      </div>
    </div>
  )
}
