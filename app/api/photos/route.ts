import { type NextRequest, NextResponse } from "next/server"
import { 
  uploadPhotoWithServiceAccount, 
  listFilesWithServiceAccount, 
  isServiceAccountConfigured, 
  clearFolderWithServiceAccount 
} from "@/lib/google-service-account"

const FOLDER_NAME = "Mosaic App Photos"
const PHOTOS_PREFIX = "photo-"

export async function GET() {
  try {
    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // List files from folder
    const files = await listFilesWithServiceAccount(FOLDER_NAME)

    // Filter to get only photos (not the main image)
    const photos = files.filter((file) => file.name?.startsWith(PHOTOS_PREFIX))

    return NextResponse.json({ photos })
  } catch (error) {
    console.error("Error getting photos:", error)
    return NextResponse.json({ 
      error: "Failed to get photos",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Generate a unique filename with timestamp
    const timestamp = new Date().getTime()
    const fileName = `${PHOTOS_PREFIX}${timestamp}.jpg`

    // Upload the photo
    const fileId = await uploadPhotoWithServiceAccount(imageData, fileName, FOLDER_NAME)

    return NextResponse.json({
      success: true,
      id: fileId,
      message: "Photo uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading photo:", error)
    return NextResponse.json(
      { error: "Failed to upload photo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Clear the folder
    const result = await clearFolderWithServiceAccount(FOLDER_NAME)

    return NextResponse.json({ 
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} photos from ${FOLDER_NAME}`
    })
  } catch (error) {
    console.error("Error deleting photos:", error)
    return NextResponse.json({
      error: "Failed to delete photos",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
