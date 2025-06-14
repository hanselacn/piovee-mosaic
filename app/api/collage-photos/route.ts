import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
  AuthenticationError,
  uploadFileWithSystemAuth,
  listFilesWithSystemAuth,
  deleteFileWithSystemAuth,
} from "@/lib/google-drive"

const COLLAGE_FOLDER_NAME = "collage-photos"

// POST - Upload a new collage photo (PUBLIC - no auth required)
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

    // Generate a unique filename
    const fileName = `collage-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`

    // Upload the photo using system authentication (no user auth required)
    const fileId = await uploadFileWithSystemAuth(photoData, fileName, COLLAGE_FOLDER_NAME)

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      message: "Collage photo uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading collage photo:", error)

    return NextResponse.json(
      {
        error: "Failed to upload collage photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET - Get all collage photos (requires auth)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    // Get photos using system authentication
    const photos = await listFilesWithSystemAuth(COLLAGE_FOLDER_NAME)

    // Get photo data for each file and sort by timestamp
    const validPhotos = photos
      .map((photo) => ({
        id: photo.id,
        name: photo.name,
        dataUrl: photo.dataUrl,
        timestamp: extractTimestampFromFilename(photo.name || ""),
      }))
      .sort((a, b) => b.timestamp - a.timestamp)

    return NextResponse.json({
      photos: validPhotos,
      count: validPhotos.length,
    })
  } catch (error) {
    console.error("Error getting collage photos:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          message: "Your session has expired. Please sign in again.",
          requiresAuth: true,
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: "Failed to get collage photos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// DELETE - Clear all collage photos (requires auth)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    // Delete all photos using system authentication
    const results = await deleteFileWithSystemAuth(COLLAGE_FOLDER_NAME)

    return NextResponse.json({
      success: true,
      message: `Cleared collage photos`,
      results,
    })
  } catch (error) {
    console.error("Error clearing collage photos:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          message: "Your session has expired. Please sign in again.",
          requiresAuth: true,
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: "Failed to clear collage photos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// Helper function to extract timestamp from filename
function extractTimestampFromFilename(filename: string): number {
  const match = filename.match(/collage-photo-(\d+)-/)
  return match ? Number.parseInt(match[1]) : 0
}
