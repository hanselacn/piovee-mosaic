import { type NextRequest, NextResponse } from "next/server"

// In-memory storage for temporary photos (in production, use a database)
let tempPhotos: Array<{
  id: string
  photoData: string
  timestamp: number
  fileName: string
}> = []

// POST - Store a photo temporarily (no auth required)
export async function POST(request: NextRequest) {
  try {
    const { photoData } = await request.json()

    if (!photoData) {
      return NextResponse.json({ error: "No photo data provided" }, { status: 400 })
    }

    // Validate photo data
    if (!photoData.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid photo data format" }, { status: 400 })
    }

    // Check photo size (limit to 5MB)
    const maxSizeBytes = 5 * 1024 * 1024
    if (photoData.length > maxSizeBytes) {
      return NextResponse.json(
        {
          error: "Photo too large",
          details: `Photo size: ${Math.round(photoData.length / 1024)}KB, max allowed: ${Math.round(maxSizeBytes / 1024)}KB`,
        },
        { status: 413 },
      )
    }

    // Generate unique ID and filename
    const id = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fileName = `collage-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`

    // Store temporarily
    tempPhotos.push({
      id,
      photoData,
      timestamp: Date.now(),
      fileName,
    })

    // Clean up old photos (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    tempPhotos = tempPhotos.filter((photo) => photo.timestamp > oneHourAgo)

    console.log(`📸 Stored temporary photo: ${fileName} (${tempPhotos.length} total)`)

    return NextResponse.json({
      success: true,
      id,
      fileName,
      message: "Photo stored temporarily, will be synced to Google Drive",
    })
  } catch (error) {
    console.error("Error storing temporary photo:", error)
    return NextResponse.json(
      {
        error: "Failed to store photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET - Get all temporary photos (no auth required for debugging)
export async function GET() {
  try {
    // Clean up old photos first
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    tempPhotos = tempPhotos.filter((photo) => photo.timestamp > oneHourAgo)

    return NextResponse.json({
      photos: tempPhotos.map((photo) => ({
        id: photo.id,
        fileName: photo.fileName,
        timestamp: photo.timestamp,
        dataUrl: photo.photoData,
      })),
      count: tempPhotos.length,
    })
  } catch (error) {
    console.error("Error getting temporary photos:", error)
    return NextResponse.json(
      { error: "Failed to get temporary photos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// DELETE - Remove a temporary photo by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get("id")

    if (!photoId) {
      return NextResponse.json({ error: "Photo ID required" }, { status: 400 })
    }

    const initialCount = tempPhotos.length
    tempPhotos = tempPhotos.filter((photo) => photo.id !== photoId)
    const removed = initialCount - tempPhotos.length

    return NextResponse.json({
      success: true,
      removed,
      message: removed > 0 ? "Photo removed from temporary storage" : "Photo not found",
    })
  } catch (error) {
    console.error("Error removing temporary photo:", error)
    return NextResponse.json(
      { error: "Failed to remove photo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
