"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./camera.module.css"

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  const maxPhotos = 10
  const [filter, setFilter] = useState("none")

  useEffect(() => {
    if (!videoRef.current) return

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch((err) => {
        alert("Camera access is required to use Piovee.")
        console.error(err)
      })
  }, [])

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
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
    setPhotos((prev) => [...prev, dataUrl])
    setPhotoCount((prev) => prev + 1)

    try {
      const response = await fetch("/api/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoData: dataUrl,
          fileName: `photo-${Date.now()}.jpg`,
        }),
      })

      if (!response.ok) throw new Error("Failed to upload photo")

      console.log("Photo uploaded successfully")
    } catch (error) {
      console.error("Error uploading photo:", error)
    }
  }

  const handleFilterChange = (filterValue: string) => {
    setFilter(filterValue)
  }

  return (
    <div className="relative min-h-screen w-full bg-[#fefaf7] text-[#5e4b44]">
      <header className="mt-8 text-center">
        <h1 className="font-[Cormorant_Garamond] text-4xl text-[#7a645f]">
          Piovee Camera
        </h1>
        <div className="font-[DM_Sans] text-sm text-[#a0918a]">
          Your wedding POV. One click at a time.
        </div>
      </header>

      <main className="flex flex-col items-center px-4">
        <div className="camera-frame mt-8 w-full max-w-[390px] aspect-[3/4] bg-black rounded-[32px] shadow-lg overflow-hidden relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ filter }}
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
        </div>

        <button
          onClick={capturePhoto}
          className="shutter mt-6 mb-4 w-[72px] h-[72px] rounded-full border-[6px] border-[#e6d5ce] bg-white shadow-lg"
          aria-label="Take photo"
        />

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
