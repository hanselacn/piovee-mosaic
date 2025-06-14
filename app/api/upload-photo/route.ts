import { NextResponse } from "next/server"
import { uploadFileWithServiceAccount, isServiceAccountConfigured } from "@/lib/google-service-account"

export async function POST(request: Request) {
  try {
    console.log("📸 Camera photo upload request received")

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { photoData } = body

    if (!photoData) {
      return NextResponse.json({ error: "Photo data is required" }, { status: 400 })
    }

    // Validate photo data format
    if (!photoData.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid photo data format" }, { status: 400 })
    }

    const photoSizeKB = Math.round(photoData.length / 1024)
    console.log(`📊 Received photo: ${photoSizeKB}KB`)

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.log("⚠️ Service account not configured, falling back to user authentication required")
      return NextResponse.json(
        {
          error: "Service account not configured",
          details: "Please configure Google Service Account environment variables for direct uploads",
          requiresAuth: true,
        },
        { status: 503 },
      )
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `camera-photo-${timestamp}.jpg`

    console.log(`📁 Uploading ${fileName} to Google Drive...`)

    // Upload using service account
    const uploadResult = await uploadFileWithServiceAccount(photoData, fileName, "Mosaic Camera Photos")

    console.log("✅ Photo uploaded successfully:", uploadResult)

    return NextResponse.json({
      success: true,
      message: "Photo uploaded to Google Drive",
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      photoSize: `${photoSizeKB}KB`,
    })
  } catch (error) {
    console.error("❌ Photo upload error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        error: "Failed to upload photo",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}

// GET endpoint for testing
export async function GET() {
  try {
    const isConfigured = isServiceAccountConfigured()

    return NextResponse.json({
      message: "Camera photo upload API",
      serviceAccountConfigured: isConfigured,
      timestamp: new Date().toISOString(),
      requiredEnvVars: [
        "GOOGLE_PROJECT_ID",
        "GOOGLE_PRIVATE_KEY",
        "GOOGLE_CLIENT_EMAIL",
        "GOOGLE_DRIVE_FOLDER_ID (optional)",
      ],
    })
  } catch (error) {
    return NextResponse.json(
      { error: "API test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
