import { NextResponse } from "next/server"
import {
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
} from "@/lib/google-service-account"

// GET - List camera photos from Google Drive
export async function GET() {
  try {
    console.log("📸 Fetching camera photos from Google Drive...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      return NextResponse.json(
        {
          error: "Service account not configured",
          photos: [],
          message: "Please configure Google Service Account to fetch camera photos",
        },
        { status: 503 },
      )
    }

    // Get list of files from Google Drive
    const files = await listFilesWithServiceAccount("Mosaic Camera Photos")

    console.log(`📁 Found ${files.length} camera photos in Google Drive`)

    // Convert files to photo format with content
    const photos = []

    for (const file of files.slice(0, 20)) {
      // Limit to 20 most recent photos
      try {
        console.log(`📷 Fetching content for ${file.name}...`)

        // Get file content as base64
        const photoData = await getFileContentWithServiceAccount(file.id!)

        photos.push({
          id: file.id,
          photoData: photoData,
          timestamp: new Date(file.createdTime || Date.now()).getTime(),
          fileName: file.name,
        })

        console.log(`✅ Loaded photo: ${file.name}`)
      } catch (error) {
        console.error(`❌ Failed to load photo ${file.name}:`, error)
        // Continue with other photos even if one fails
      }
    }

    console.log(`✅ Successfully loaded ${photos.length} camera photos`)

    return NextResponse.json({
      success: true,
      photos: photos,
      totalFiles: files.length,
      loadedPhotos: photos.length,
    })
  } catch (error) {
    console.error("❌ Error fetching camera photos:", error)

    return NextResponse.json(
      {
        error: "Failed to fetch camera photos",
        details: error instanceof Error ? error.message : "Unknown error",
        photos: [],
      },
      { status: 500 },
    )
  }
}

// DELETE - Clear all camera photos
export async function DELETE() {
  try {
    console.log("🗑️ Clearing all camera photos...")

    if (!isServiceAccountConfigured()) {
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    const { clearFolderWithServiceAccount } = await import("@/lib/google-service-account")
    const result = await clearFolderWithServiceAccount("Mosaic Camera Photos")

    console.log(`✅ Cleared ${result.deletedCount} camera photos`)

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} photos`,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error("❌ Error clearing camera photos:", error)

    return NextResponse.json(
      {
        error: "Failed to clear camera photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
