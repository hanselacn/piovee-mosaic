import { type NextRequest, NextResponse } from "next/server"
import {
  uploadCollagePhotoWithServiceAccount,
  listFilesWithServiceAccount,
  isServiceAccountConfigured,
  clearFolderWithServiceAccount,
} from "@/lib/google-service-account"

const COLLAGE_FOLDER_NAME = "Mosaic Collages"

// POST - Upload a new collage photo
export async function POST(request: NextRequest) {
  try {
    console.log("📤 Processing collage photo upload request")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

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

    // Upload using service account
    console.log(`📤 Uploading collage photo: ${fileName}`)
    const fileId = await uploadCollagePhotoWithServiceAccount(photoData, fileName, COLLAGE_FOLDER_NAME)
    console.log(`✅ Collage photo uploaded successfully: ${fileName} (${fileId})`)

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      message: "Collage photo uploaded successfully",
    })
  } catch (error) {
    console.error("❌ Error uploading collage photo:", error)
    return NextResponse.json(
      {
        error: "Failed to upload collage photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET - List collage photos
export async function GET() {
  try {
    console.log("📂 Listing collage photos")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // List files from the collages folder
    const files = await listFilesWithServiceAccount(COLLAGE_FOLDER_NAME)
    console.log(`📂 Found ${files.length} collage photos`)

    return NextResponse.json({
      photos: files,
      folderInfo: {
        folderName: COLLAGE_FOLDER_NAME,
        totalFiles: files.length,
      },
    })
  } catch (error) {
    console.error("❌ Error listing collage photos:", error)
    return NextResponse.json(
      {
        error: "Failed to list collage photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// DELETE - Clear all collage photos
export async function DELETE() {
  try {
    console.log("🗑️ Clearing all collage photos")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Clear the collages folder
    const result = await clearFolderWithServiceAccount(COLLAGE_FOLDER_NAME)
    console.log(`✅ Cleared ${result.deletedCount} collage photos`)

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} photos from ${COLLAGE_FOLDER_NAME} folder`,
    })
  } catch (error) {
    console.error("❌ Error clearing collage photos:", error)
    return NextResponse.json(
      {
        error: "Failed to clear collage photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
