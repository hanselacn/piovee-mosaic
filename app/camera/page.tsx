"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { getPusherClient, isPusherConnected } from "@/lib/pusher-client"

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [photoTaken, setPhotoTaken] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [pusherConnected, setPusherConnected] = useState(false)
  const shutterSound = useRef<HTMLAudioElement | null>(null)

  // Initialize shutter sound and check Pusher connection
  useEffect(() => {
    shutterSound.current = new Audio("/camera-shutter.mp3")

    try {
      // Get Pusher client and check connection
      const pusher = getPusherClient()

      // Update connection state immediately
      setPusherConnected(isPusherConnected())

      // Listen for connection state changes
      pusher.connection.bind("connected", () => {
        console.log("Camera: Pusher connected")
        setPusherConnected(true)
      })

      pusher.connection.bind("disconnected", () => {
        console.log("Camera: Pusher disconnected")
        setPusherConnected(false)
      })

      // Force connection if not already connected
      if (pusher.connection.state !== "connected") {
        console.log("Camera: Forcing Pusher connection...")
        pusher.connect()
      }
    } catch (error) {
      console.error("Camera: Error setting up Pusher:", error)
    }

    return () => {
      const pusher = getPusherClient()
      pusher.connection.unbind("connected")
      pusher.connection.unbind("disconnected")
    }
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
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

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Play shutter sound
    if (shutterSound.current) {
      shutterSound.current.play().catch((e) => console.error("Error playing sound:", e))
    }

    // Get image data
    const photoData = canvas.toDataURL("image/jpeg", 0.7) // Compress for better performance
    setPhotoTaken(true)

    // Send photo via API (which will use Pusher)
    sendPhotoToServer(photoData)
  }

  // Send photo to server
  const sendPhotoToServer = async (photoData: string) => {
    setIsSending(true)
    try {
      const response = await fetch("/api/send-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoData }),
      })

      if (!response.ok) {
        throw new Error("Failed to send photo")
      }

      console.log("Photo sent successfully")
    } catch (error) {
      console.error("Error sending photo:", error)
      alert("Failed to send photo. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  // Reset photo
  const resetPhoto = () => {
    setPhotoTaken(false)
  }

  // Function to manually reconnect Pusher
  const reconnectPusher = () => {
    try {
      const pusher = getPusherClient()
      pusher.connect()
    } catch (error) {
      console.error("Error reconnecting to Pusher:", error)
    }
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
          <div className={`w-3 h-3 rounded-full ${pusherConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span>{pusherConnected ? "Connected" : "Disconnected"}</span>
          {!pusherConnected && (
            <button onClick={reconnectPusher} className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
              Reconnect
            </button>
          )}
        </div>

        <Link href="/">
          <Button variant="outline">Back to Mosaic</Button>
        </Link>
      </div>

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
          <Button onClick={takePhotoWithCountdown} disabled={countdown > 0 || !pusherConnected}>
            Take Photo
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
          <p className="mt-2">Sending photo...</p>
        </div>
      )}

      {/* Debug info */}
      <div className="mt-8 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
        <h3 className="font-bold mb-2">Debug Information</h3>
        <div>Pusher Connected: {pusherConnected ? "Yes" : "No"}</div>
        <div>Camera Active: {isCameraActive ? "Yes" : "No"}</div>
        <div>Photo Taken: {photoTaken ? "Yes" : "No"}</div>
        <div>Environment: {process.env.NODE_ENV}</div>
        <div>Pusher App Key: {process.env.NEXT_PUBLIC_PUSHER_APP_KEY ? "Set" : "Not Set"}</div>
        <div>Pusher Cluster: {process.env.NEXT_PUBLIC_PUSHER_CLUSTER}</div>
      </div>
    </div>
  )
}
