import { type NextRequest, NextResponse } from "next/server"
import {
  uploadPhotoWithServiceAccount,
  listFilesWithServiceAccount,
  getFileContentWithServiceAccount,
  deleteFileWithServiceAccount,
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
    }    console.log("🗑️ Clearing existing main images...")

    // Get existing main image from Firestore and delete from Google Drive
    const existingDoc = await db.collection('main-image').doc('current').get()
    if (existingDoc.exists) {
      const existingData = existingDoc.data()
      if (existingData?.fileId) {
        try {
          await deleteFileWithServiceAccount(existingData.fileId)
          console.log(`🗑️ Deleted existing main image: ${existingData.fileName}`)
        } catch (error) {
          console.error(`❌ Error deleting existing main image:`, error)
        }
      }
    }// Generate a unique filename with main-image prefix
    const fileName = `main-image-${Date.now()}.jpg`

    console.log(`📤 Uploading main image: ${fileName}`)

    // Upload to Google Drive first
    const fileId = await uploadPhotoWithServiceAccount(imageData, fileName, process.env.GOOGLE_DRIVE_FOLDER_ID!)

    console.log("✅ Main image uploaded to Google Drive")

    // Save metadata and grid configuration to Firestore (without the large image data)
    await db.collection('main-image').doc('current').set({
      fileId,
      fileName,
      timestamp: Date.now(),
      gridConfig: gridConfig || {
        cols: 20,
        rows: 15,
        tileSize: 20,
        totalTiles: 300
      }
    })

    console.log("✅ Main image metadata and grid config saved to Firestore")

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

    // Get main image metadata from Firestore
    const doc = await db.collection('main-image').doc('current').get()
    
    if (!doc.exists) {
      console.log("📥 No main image found in Firestore")
      return NextResponse.json({ mainImage: null })
    }

    const data = doc.data()
    
    // Get the image data from Google Drive
    let dataUrl = null
    if (data?.fileId) {
      try {
        console.log("📥 Fetching image data from Google Drive...")
        dataUrl = await getFileContentWithServiceAccount(data.fileId)
        console.log("✅ Image data retrieved from Google Drive")
      } catch (error) {
        console.error("❌ Error fetching image from Google Drive:", error)
        // Continue without image data - the grid config is still useful
      }
    }
    
    console.log("✅ Main image loaded successfully")

    return NextResponse.json({
      mainImage: {
        dataUrl,
        fileName: data?.fileName,
        fileId: data?.fileId,
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
