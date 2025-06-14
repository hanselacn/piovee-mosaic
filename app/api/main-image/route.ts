import { type NextRequest, NextResponse } from "next/server"
import {
  uploadPhotoWithServiceAccount,
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
} from "@/lib/google-service-account"

export async function POST(request: NextRequest) {
  try {
    console.log("📤 Main image upload request received")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    console.log("🗑️ Clearing existing main images...")

    // Get existing files and delete main images
    const existingFiles = await listFilesWithServiceAccount("Mosaic Camera Photos")
    const mainImageFiles = existingFiles.filter((file) => file.name?.startsWith("main-image-"))

    for (const file of mainImageFiles) {
      if (file.id) {
        try {
          // We'll need to add a delete function to the service account lib
          console.log(`🗑️ Would delete existing main image: ${file.name}`)
        } catch (error) {
          console.error(`❌ Error deleting existing main image ${file.id}:`, error)
        }
      }
    }

    // Generate a unique filename with main-image prefix
    const fileName = `main-image-${Date.now()}.jpg`

    console.log(`📤 Uploading main image: ${fileName}`)

    // Upload using service account
    const fileId = await uploadPhotoWithServiceAccount(imageData, fileName, "Mosaic Camera Photos")

    console.log(`✅ Main image uploaded successfully: ${fileId}`)

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      message: "Main image uploaded successfully",
    })
  } catch (error) {
    console.error("❌ Error uploading main image:", error)

    return NextResponse.json(
      {
        error: "Failed to upload main image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    console.log("📥 Main image fetch request received")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // List files to find the most recent main image
    const files = await listFilesWithServiceAccount("Mosaic Camera Photos")
    const mainImage = files.find((file) => file.name?.startsWith("main-image-"))

    if (!mainImage || !mainImage.id) {
      console.log("📥 No main image found")
      return NextResponse.json({ mainImage: null })
    }

    console.log(`📥 Found main image: ${mainImage.name}`)

    // Get the image content
    const dataUrl = await getFileContentWithServiceAccount(mainImage.id)

    console.log("✅ Main image loaded successfully")

    return NextResponse.json({
      mainImage: {
        id: mainImage.id,
        name: mainImage.name,
        dataUrl,
      },
    })
  } catch (error) {
    console.error("❌ Error getting main image:", error)

    return NextResponse.json(
      { error: "Failed to get main image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
