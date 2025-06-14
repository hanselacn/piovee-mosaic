import { NextResponse } from "next/server"
import {
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
} from "@/lib/google-service-account"

// GET - List all camera photos
export async function GET() {
  try {
    console.log("📁 Fetching camera photos from Google Drive...")

    if (!isServiceAccountConfigured()) {
      return NextResponse.json(
        {
          error: "Service account not configured",
          photos: [],
        },
        { status: 503 },
      )
    }

    // List files from the camera photos folder
    const files = await listFilesWithServiceAccount("Mosaic Camera Photos")

    console.log(`📁 Found ${files.length} camera photos`)

    // Convert to photo objects with content
    const photos = []
    for (const file of files.slice(0, 20)) {
      // Limit to 20 most recent photos
      try {
        const content = await getFileContentWithServiceAccount(file.id!)
        photos.push({
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          content: content,
        })
      } catch (contentError) {
        console.error(`❌ Failed to get content for file ${file.name}:`, contentError)
        // Skip this file and continue
      }
    }

    return NextResponse.json({
      success: true,
      photos: photos,
      totalCount: files.length,
      message: `Found ${photos.length} camera photos`,
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
