"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [requestedTiles, setRequestedTiles] = useState<number>(192) // Default: 192 tiles
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setUploadSuccess(false)
    } else {
      alert("Please select a valid image file")
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !previewUrl) return

    setUploading(true)
    try {
      const response = await fetch("/api/main-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataUrl: previewUrl,
          filename: selectedFile.name,
          minTiles: requestedTiles,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setUploadSuccess(true)
        console.log("Main image uploaded successfully with optimal tile calculation")
      } else {
        alert("Failed to upload image")
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl("")
    setUploadSuccess(false)
    setRequestedTiles(192)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const goToMosaic = () => {
    router.push("/")
  }

  // Calculate optimal tile settings that fill the entire canvas
  const calculateOptimalTileSettings = (requestedTiles: number) => {
    const width = 800
    const height = 600

    let bestTileSize = 1
    let bestTileCount = 0
    let bestCols = 0
    let bestRows = 0
    let smallestDifference = Number.POSITIVE_INFINITY

    // Try different tile sizes
    for (let tileSize = 1; tileSize <= Math.min(width, height); tileSize++) {
      const cols = Math.floor(width / tileSize)
      const rows = Math.floor(height / tileSize)
      const actualTiles = cols * rows

      const difference = Math.abs(actualTiles - requestedTiles)

      if (difference < smallestDifference) {
        smallestDifference = difference
        bestTileSize = tileSize
        bestTileCount = actualTiles
        bestCols = cols
        bestRows = rows
      }
    }

    return {
      tileSize: bestTileSize,
      actualTiles: bestTileCount,
      cols: bestCols,
      rows: bestRows,
      canvasWidth: bestCols * bestTileSize,
      canvasHeight: bestRows * bestTileSize,
      coverage: ((bestCols * bestTileSize * bestRows * bestTileSize) / (width * height)) * 100,
    }
  }

  const optimalSettings = calculateOptimalTileSettings(requestedTiles)

  const getDensityLabel = (tiles: number) => {
    if (tiles < 100) return "Very Low Density"
    if (tiles < 200) return "Low Density"
    if (tiles < 400) return "Medium Density"
    if (tiles < 600) return "High Density"
    return "Ultra High Density"
  }

  const presetTiles = [
    { label: "Quick (100)", value: 100, description: "Fast completion, large tiles" },
    { label: "Balanced (200)", value: 200, description: "Good balance of detail and speed" },
    { label: "Detailed (400)", value: 400, description: "More detail, takes longer" },
    { label: "Ultra (800)", value: 800, description: "Maximum detail, many photos needed" },
  ]

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111827", padding: "2rem" }}>
      <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
        <div
          style={{
            backgroundColor: "#1f2937",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            border: "1px solid #374151",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "2rem", borderBottom: "1px solid #374151" }}>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                margin: "0 0 1rem 0",
                color: "white",
                textAlign: "center",
              }}
            >
              🖼️ Upload Main Image
            </h1>
            <p style={{ color: "#9ca3af", textAlign: "center", margin: "0" }}>
              Upload your main image and choose target tile count (system will find the closest perfect fit)
            </p>
          </div>

          <div style={{ padding: "2rem" }}>
            {!previewUrl ? (
              <div>
                {/* Step 1: Choose Target Tile Count */}
                <div style={{ marginBottom: "2rem" }}>
                  <h2 style={{ color: "white", fontSize: "1.5rem", marginBottom: "1rem", textAlign: "center" }}>
                    🎯 Step 1: Choose Target Tile Count
                  </h2>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{
                        color: "white",
                        fontSize: "1.125rem",
                        display: "block",
                        marginBottom: "0.75rem",
                        textAlign: "center",
                      }}
                    >
                      Target number of tiles:
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="2000"
                      value={requestedTiles}
                      onChange={(e) => setRequestedTiles(Number.parseInt(e.target.value) || 192)}
                      style={{
                        backgroundColor: "#374151",
                        color: "white",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        border: "2px solid #3b82f6",
                        width: "100%",
                        fontSize: "1.25rem",
                        textAlign: "center",
                        marginBottom: "0.75rem",
                      }}
                      placeholder="Enter target tile count (e.g., 192)"
                    />
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                      <div style={{ fontSize: "1rem", color: "#10b981", fontWeight: "bold" }}>
                        {getDensityLabel(optimalSettings.actualTiles)}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                        Optimal: {optimalSettings.actualTiles} tiles | Size: {optimalSettings.tileSize}×
                        {optimalSettings.tileSize}px
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        Grid: {optimalSettings.cols}×{optimalSettings.rows} | Coverage:{" "}
                        {optimalSettings.coverage.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <div
                      style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "0.75rem", textAlign: "center" }}
                    >
                      Quick Presets:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      {presetTiles.map((preset) => {
                        const presetOptimal = calculateOptimalTileSettings(preset.value)
                        return (
                          <button
                            key={preset.value}
                            onClick={() => setRequestedTiles(preset.value)}
                            style={{
                              backgroundColor: requestedTiles === preset.value ? "#3b82f6" : "#374151",
                              color: "white",
                              padding: "1rem",
                              borderRadius: "0.5rem",
                              border: requestedTiles === preset.value ? "2px solid #60a5fa" : "1px solid #4b5563",
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "all 0.2s",
                            }}
                          >
                            <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>{preset.label}</div>
                            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>→ {presetOptimal.actualTiles} tiles</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "1.5rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1rem", color: "#10b981", marginBottom: "0.5rem", fontWeight: "bold" }}>
                      📊 Optimal Mosaic Preview
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#9ca3af", lineHeight: "1.5" }}>
                      Target: {requestedTiles} tiles → Optimal:{" "}
                      <span style={{ color: "#10b981", fontWeight: "bold" }}>{optimalSettings.actualTiles} tiles</span>
                      <br />
                      Canvas: 800×600px → Covered: {optimalSettings.canvasWidth}×{optimalSettings.canvasHeight}px
                      <br />
                      Tile Size: {optimalSettings.tileSize}×{optimalSettings.tileSize}px
                      <br />
                      Grid: {optimalSettings.cols} columns × {optimalSettings.rows} rows
                      <br />
                      Coverage:{" "}
                      <span style={{ color: "#10b981", fontWeight: "bold" }}>
                        {optimalSettings.coverage.toFixed(1)}%
                      </span>{" "}
                      of canvas
                    </div>
                  </div>
                </div>

                {/* Step 2: Upload Image */}
                <div>
                  <h2 style={{ color: "white", fontSize: "1.5rem", marginBottom: "1rem", textAlign: "center" }}>
                    📁 Step 2: Select Your Main Image
                  </h2>
                  <div
                    style={{
                      border: "2px dashed #374151",
                      borderRadius: "0.5rem",
                      padding: "3rem",
                      textAlign: "center",
                      backgroundColor: "#111827",
                    }}
                  >
                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📁</div>
                    <p style={{ color: "#9ca3af", marginBottom: "1rem" }}>Click to select an image or drag and drop</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{
                        backgroundColor: "#3b82f6",
                        color: "white",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "0.375rem",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    border: "1px solid #374151",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    marginBottom: "1.5rem",
                  }}
                >
                  <img
                    src={previewUrl || "/placeholder.svg"}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "400px",
                      objectFit: "cover",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "2rem" }}>
                  <h3 style={{ color: "white", fontSize: "1.25rem", marginBottom: "1rem", textAlign: "center" }}>
                    🎯 Final Mosaic Settings
                  </h3>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label
                      style={{
                        color: "white",
                        fontSize: "1rem",
                        display: "block",
                        marginBottom: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      Target Tile Count:
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="2000"
                      value={requestedTiles}
                      onChange={(e) => setRequestedTiles(Number.parseInt(e.target.value) || 192)}
                      style={{
                        backgroundColor: "#374151",
                        color: "white",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        border: "2px solid #3b82f6",
                        width: "100%",
                        fontSize: "1.125rem",
                        textAlign: "center",
                        marginBottom: "0.75rem",
                      }}
                    />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1rem", color: "#10b981", fontWeight: "bold" }}>
                        {getDensityLabel(optimalSettings.actualTiles)}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
                        Optimal: {optimalSettings.actualTiles} tiles | Size: {optimalSettings.tileSize}×
                        {optimalSettings.tileSize}px
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#111827",
                      padding: "1.5rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #374151",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1rem", color: "#10b981", marginBottom: "0.5rem", fontWeight: "bold" }}>
                      📊 Perfect Fit Mosaic
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#9ca3af", lineHeight: "1.5" }}>
                      Image: {selectedFile?.name}
                      <br />
                      Target: {requestedTiles} → Optimal:{" "}
                      <span style={{ color: "#10b981", fontWeight: "bold" }}>{optimalSettings.actualTiles} tiles</span>
                      <br />
                      Tile Size: {optimalSettings.tileSize}×{optimalSettings.tileSize}px
                      <br />
                      Grid: {optimalSettings.cols}×{optimalSettings.rows} (perfect fit)
                      <br />
                      Coverage:{" "}
                      <span style={{ color: "#10b981", fontWeight: "bold" }}>
                        {optimalSettings.coverage.toFixed(1)}%
                      </span>{" "}
                      of canvas
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  {uploadSuccess ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <div
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          padding: "1rem",
                          borderRadius: "0.5rem",
                          marginBottom: "1rem",
                          fontSize: "1.125rem",
                        }}
                      >
                        ✅ Perfect fit mosaic created with {optimalSettings.actualTiles} tiles!
                      </div>
                      <button
                        onClick={goToMosaic}
                        style={{
                          backgroundColor: "#10b981",
                          color: "white",
                          padding: "1rem 2rem",
                          borderRadius: "0.5rem",
                          border: "none",
                          cursor: "pointer",
                          marginRight: "0.5rem",
                          fontSize: "1.125rem",
                        }}
                      >
                        🎨 Start Taking Photos!
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      style={{
                        backgroundColor: uploading ? "#6b7280" : "#10b981",
                        color: "white",
                        padding: "1rem 2rem",
                        borderRadius: "0.5rem",
                        border: "none",
                        cursor: uploading ? "not-allowed" : "pointer",
                        marginRight: "0.5rem",
                        fontSize: "1.125rem",
                        fontWeight: "bold",
                      }}
                    >
                      {uploading
                        ? "⏳ Creating Perfect Fit..."
                        : `🚀 Create Perfect Mosaic (${optimalSettings.actualTiles} tiles)`}
                    </button>
                  )}

                  <button
                    onClick={handleReset}
                    style={{
                      backgroundColor: "#6b7280",
                      color: "white",
                      padding: "1rem 2rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                  >
                    🔄 Start Over
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "1rem 2rem", backgroundColor: "#111827" }}>
            <button
              onClick={goToMosaic}
              style={{
                backgroundColor: "transparent",
                color: "#9ca3af",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #374151",
                cursor: "pointer",
                width: "100%",
              }}
            >
              ← Back to Mosaic
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
