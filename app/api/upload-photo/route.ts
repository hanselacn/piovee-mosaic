import { type NextRequest, NextResponse } from "next/server"
import { uploadPhotoWithServiceAccount, isServiceAccountConfigured } from "@/lib/google-service-account"

export async function POST(request: NextRequest) {
  try {
    console.log("📤 API: Photo upload request received")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ API: Service account not configured")
      return NextResponse.json(
        {
          error: "Service account not configured",
          message: "Please configure Google Service Account environment variables",
        },
        { status: 503 },
      )
    }

    // Parse request body
    const body = await request.json()
    const { photoData } = body

    if (!photoData) {
      console.error("❌ API: No photo data provided")
      return NextResponse.json({ error: "No photo data provided" }, { status: 400 })
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `camera-photo-${timestamp}.jpg`

    console.log(`📤 API: Uploading photo: ${fileName}`)

    // Upload to Google Drive using service account
    const fileId = await uploadPhotoWithServiceAccount(photoData, fileName, "Mosaic Camera Photos")

    console.log(`✅ API: Photo uploaded successfully: ${fileName} (${fileId})`)

    return NextResponse.json({
      success: true,
      message: "Photo uploaded successfully",
      fileId: fileId,
      fileName: fileName,
    })
  } catch (error) {
    console.error("❌ API: Error uploading photo:", error)

    return NextResponse.json(
      {
        error: "Failed to upload photo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
