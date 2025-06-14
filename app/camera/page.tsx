"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string>("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastPhoto, setLastPhoto] = useState<string>("")
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  // Check authentication on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (!response.ok) {
          setError("Please sign in to use the camera")
          setTimeout(() => {
            window.location.href = "/auth/signin"
          }, 2000)
          return
        }
        console.log("✅ Authentication verified")
      } catch (error) {
        console.error("Auth check failed:", error)
        setError("Authentication check failed. Please sign in.")
        setTimeout(() => {
          window.location.href = "/auth/signin"
        }, 2000)
      }
    }

    checkAuth()
  }, [])

  const startCamera = useCallback(async () => {
    try {
      setError("")
      console.log(`📷 Starting camera with facing mode: ${facingMode}`)

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setIsStreaming(true)
          console.log("✅ Camera started successfully")
        }
      }
    } catch (err: any) {
      console.error("❌ Camera error:", err)
      let errorMessage = "Failed to access camera"

      if (err.name === "NotAllowedError") {
        errorMessage = "Camera permission denied. Please allow camera access and try again."
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found on this device."
      } else if (err.name === "NotSupportedError") {
        errorMessage = "Camera not supported on this device."
      } else if (err.name === "OverconstrainedError") {
        errorMessage = "Camera constraints not supported. Trying with basic settings..."
        // Try with basic constraints
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play()
              setIsStreaming(true)
              console.log("✅ Camera started with basic settings")
            }
          }
          return
        } catch (basicErr) {
          errorMessage = "Failed to start camera even with basic settings"
        }
      }

      setError(errorMessage)
    }
  }, [facingMode])

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsStreaming(false)
      console.log("📷 Camera stopped")
    }
  }, [])

  const flipCamera = useCallback(() => {
    stopCamera()
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
    setTimeout(() => {
      startCamera()
    }, 500)
  }, [stopCamera, startCamera])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return

    try {
      setIsCapturing(true)
      setUploadStatus("📸 Capturing photo...")

      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("Could not get canvas context")
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Get the image data
      const photoDataUrl = canvas.toDataURL("image/jpeg", 0.8)
      setLastPhoto(photoDataUrl)

      console.log("📸 Photo captured, uploading...")
      setUploadStatus("☁️ Uploading to Google Drive...")

      // Upload to Google Drive
      const response = await fetch("/api/upload-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoData: photoDataUrl,
          fileName: `camera-${Date.now()}.jpg`,
        }),
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type")
        if (contentType && contentType.includes("text/html")) {
          // This is likely a redirect to sign-in page
          setError("Authentication required. Please sign in first.")
          setTimeout(() => {
            window.location.href = "/auth/signin"
          }, 2000)
          return
        }

        try {
          const errorData = await response.json()
          throw new Error(errorData.error || `Upload failed: ${response.status}`)
        } catch (jsonError) {
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
        }
      }

      const result = await response.json()
      console.log("✅ Photo uploaded successfully:", result)

      setUploadStatus("✅ Photo uploaded successfully!")
      setTimeout(() => setUploadStatus(""), 3000)
    } catch (error: any) {
      console.error("❌ Error capturing/uploading photo:", error)
      setError(error.message || "Failed to capture or upload photo")
      setUploadStatus("❌ Upload failed")
      setTimeout(() => setUploadStatus(""), 3000)
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">📷 Camera</h1>
        <Link href="/">
          <Button variant="outline">← Back to Mosaic</Button>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-4 border-red-500 bg-red-50">
          <AlertDescription className="text-red-700">
            <strong>Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Status */}
      {uploadStatus && (
        <div
          className={`mb-4 p-3 rounded ${
            uploadStatus.includes("❌")
              ? "bg-red-100 border border-red-400 text-red-700"
              : uploadStatus.includes("✅")
                ? "bg-green-100 border border-green-400 text-green-700"
                : "bg-blue-100 border border-blue-400 text-blue-700"
          }`}
        >
          <strong>Status:</strong> {uploadStatus}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Camera Feed</span>
              <div className="flex gap-2">
                {isStreaming && (
                  <Button onClick={flipCamera} variant="outline" size="sm">
                    🔄 Flip
                  </Button>
                )}
                {!isStreaming ? (
                  <Button onClick={startCamera} className="bg-green-600 hover:bg-green-700">
                    📷 Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive">
                    ⏹️ Stop Camera
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-auto rounded-lg border"
                playsInline
                muted
                style={{ maxHeight: "400px", objectFit: "cover" }}
              />
              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                  <p className="text-gray-500">Camera not active</p>
                </div>
              )}
            </div>

            {isStreaming && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={capturePhoto}
                  disabled={isCapturing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                >
                  {isCapturing ? "📸 Capturing..." : "📸 Capture Photo"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Last Captured Photo</CardTitle>
          </CardHeader>
          <CardContent>
            {lastPhoto ? (
              <div className="space-y-4">
                <img
                  src={lastPhoto || "/placeholder.svg"}
                  alt="Last captured"
                  className="w-full h-auto rounded-lg border"
                />
                <p className="text-sm text-gray-600 text-center">Photo captured and uploaded to Google Drive</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                <p className="text-gray-500">No photo captured yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-bold mb-2 text-blue-800">Camera Instructions:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Click "Start Camera" to begin</li>
          <li>• Use "Flip" to switch between front and back camera</li>
          <li>• Click "Capture Photo" to take and upload a photo</li>
          <li>• Photos are automatically uploaded to Google Drive</li>
          <li>• Return to the main page to see photos in the mosaic</li>
          <li>• Make sure you're signed in to Google to upload photos</li>
        </ul>
      </div>
    </div>
  )
}
