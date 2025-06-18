import { NextResponse } from "next/server"
import {
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
  listFilesWithServiceAccount,
  clearFolderWithServiceAccount,
} from "@/lib/google-service-account"


export async function GET(req: Request) {
  try {
    console.log("📸 Fetching camera photos...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Get files from the Camera Photos folder
    const files = await listFilesWithServiceAccount(process.env.GOOGLE_DRIVE_CAM_PHOTO_ID!)
    console.log(`📷 Found ${files.length} files in Camera Photos folder`)

    if (files.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    // Get content for each photo
    const photos = []
    for (const file of files) {
      try {
        console.log(`📥 Loading photo: ${file.name}`)
        const photoData = await getFileContentWithServiceAccount(file.id)

        photos.push({
          id: file.id,
          fileName: file.name,
          photoData,
          timestamp: new Date(file.createdTime || Date.now()).getTime(),
          createdTime: file.createdTime,
        })
      } catch (error) {
        console.error(`❌ Error loading photo ${file.name}:`, error)
      }
    }

    console.log(`✅ Successfully loaded ${photos.length} camera photos`)

    return NextResponse.json({
      photos,
      folderInfo: {
        folderId: process.env.GOOGLE_DRIVE_CAM_PHOTO_ID!,
        totalFiles: files.length,
      },
    })
  } catch (error) {
    console.error("❌ Error fetching camera photos:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch camera photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    console.log("🗑️ Clearing camera photos...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Clear the Camera Photos folder
    const result = await clearFolderWithServiceAccount(process.env.GOOGLE_DRIVE_CAM_PHOTO_ID!)
    console.log(`✅ Cleared ${result.deletedCount} camera photos`)

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} photos from Camera Photos folder`,
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
