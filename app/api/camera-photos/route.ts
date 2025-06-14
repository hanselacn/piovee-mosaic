import { NextResponse } from "next/server"
import {
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
  clearFolderWithServiceAccount,
} from "@/lib/google-service-account"

// GET - List camera photos from Google Drive "Camera Photos" folder
export async function GET() {
  try {
    console.log("📸 API: Starting camera photos fetch from 'Camera Photos' folder...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ API: Service account not configured")
      return NextResponse.json(
        {
          error: "Service account not configured",
          photos: [],
        },
        { status: 503 },
      )
    }

    // Get list of files from the "Camera Photos" folder specifically
    console.log("📁 API: Getting file list from 'Camera Photos' folder...")
    const files = await listFilesWithServiceAccount("Camera Photos")

    console.log(`📁 API: Found ${files.length} files in Camera Photos folder`)
    console.log(
      "📁 API: File list:",
      files.map((f) => ({ id: f.id, name: f.name, size: f.size })),
    )

    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        photos: [],
        totalFiles: 0,
        message: "No photos found in Camera Photos folder",
      })
    }

    // Convert files to photo format with content
    const photos = []

    // Process up to 10 most recent photos (reduced for faster loading)
    const filesToProcess = files.slice(0, 10)
    console.log(`📷 API: Processing ${filesToProcess.length} photos from Camera Photos folder...`)

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      try {
        console.log(`📷 API: Loading photo ${i + 1}/${filesToProcess.length}: ${file.name} (${file.id})`)

        // Get file content as base64
        const photoData = await getFileContentWithServiceAccount(file.id!)

        const photo = {
          id: file.id,
          photoData: photoData,
          timestamp: new Date(file.createdTime || Date.now()).getTime(),
          fileName: file.name,
          size: file.size || 0,
        }

        photos.push(photo)
        console.log(`✅ API: Successfully loaded ${file.name} from Camera Photos folder`)
      } catch (error) {
        console.error(`❌ API: Failed to load photo ${file.name}:`, error)
        console.error(`❌ API: Error details:`, error instanceof Error ? error.message : String(error))
        // Continue with other photos even if one fails
      }
    }

    console.log(
      `✅ API: Successfully processed ${photos.length}/${filesToProcess.length} photos from Camera Photos folder`,
    )

    return NextResponse.json({
      success: true,
      photos: photos,
      totalFiles: files.length,
      loadedPhotos: photos.length,
    })
  } catch (error) {
    console.error("❌ API: Error in camera-photos endpoint:", error)
    console.error("❌ API: Error stack:", error instanceof Error ? error.stack : String(error))

    return NextResponse.json(
      {
        error: "Failed to fetch camera photos from Camera Photos folder",
        details: error instanceof Error ? error.message : "Unknown error",
        photos: [],
      },
      { status: 500 },
    )
  }
}

// DELETE - Clear all camera photos from "Camera Photos" folder
export async function DELETE() {
  try {
    console.log("🗑️ API: Clearing all camera photos from 'Camera Photos' folder...")

    if (!isServiceAccountConfigured()) {
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    const result = await clearFolderWithServiceAccount("Camera Photos")

    console.log(`✅ API: Cleared ${result.deletedCount} camera photos from Camera Photos folder`)

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} photos from Camera Photos folder`,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error("❌ API: Error clearing camera photos from Camera Photos folder:", error)

    return NextResponse.json(
      {
        error: "Failed to clear camera photos from Camera Photos folder",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
