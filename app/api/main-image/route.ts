import { type NextRequest, NextResponse } from "next/server"
import {
  uploadPhotoWithServiceAccount,
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  isServiceAccountConfigured,
} from "@/lib/google-service-account"
import { db } from '@/lib/firestore'
import { writeFile, unlink } from "fs/promises"
import path from "path"

const MAIN_IMAGE_FILE = path.join(process.cwd(), "photos", "main-image.json")

export async function POST(request: NextRequest) {
  try {
    console.log("📤 Main image upload request received")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    const { imageData, gridConfig } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    console.log("🗑️ Clearing existing main images...")

    // Get existing files and delete main images
    const existingFiles = await listFilesWithServiceAccount(process.env.GOOGLE_DRIVE_FOLDER_ID!)
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

    // Save to Firestore with grid configuration
    await db.collection('main-image').doc('current').set({
      dataUrl: imageData,
      fileName,
      timestamp: Date.now(),
      gridConfig: gridConfig || {
        cols: 20,
        rows: 15,
        tileSize: 20,
        totalTiles: 300
      }
    })

    console.log("✅ Main image and grid config saved to Firestore")

    // Upload using service account
    const fileId = await uploadPhotoWithServiceAccount(imageData, fileName, process.env.GOOGLE_DRIVE_FOLDER_ID!)

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

    // Get main image from Firestore
    const doc = await db.collection('main-image').doc('current').get()
    
    if (!doc.exists) {
      console.log("📥 No main image found in Firestore")
      return NextResponse.json({ mainImage: null })
    }

    const data = doc.data()
    console.log("✅ Main image loaded successfully from Firestore")

    return NextResponse.json({
      mainImage: {
        dataUrl: data?.dataUrl,
        fileName: data?.fileName,
        gridConfig: data?.gridConfig,
        timestamp: data?.timestamp,
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

export async function DELETE() {
  try {
    await unlink(MAIN_IMAGE_FILE)
    return NextResponse.json({ success: true })
  } catch (error) {
    // If file doesn't exist, still return success
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ success: true })
    }
    console.error("Error deleting main image:", error)
    return NextResponse.json({ error: "Failed to delete main image" }, { status: 500 })
  }
}
