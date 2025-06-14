import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { uploadFile, listFiles, getFileContent, deleteFile, AuthenticationError } from "@/lib/google-drive"

export async function GET() {
  try {
    const mainImageFolderId = process.env.GOOGLE_DRIVE_MAIN_IMAGE_FOLDER_ID
    if (!mainImageFolderId) {
      return NextResponse.json(
        {
          error: "Main image folder not configured. Please set GOOGLE_DRIVE_MAIN_IMAGE_FOLDER_ID environment variable.",
        },
        { status: 500 },
      )
    }

    console.log("📁 Fetching main image from folder:", mainImageFolderId)

    const files = await listFiles(mainImageFolderId)
    console.log(`📄 Found ${files.length} files in main image folder`)

    if (files.length === 0) {
      return NextResponse.json({ mainImage: null })
    }

    // Get the most recent image file
    const imageFile = files[0]
    console.log("🖼️ Getting main image content for:", imageFile.name)

    const imageContent = await getFileContent(imageFile.id!)

    const mainImageData = {
      dataUrl: imageContent,
      filename: imageFile.name || "main-image.jpg",
      uploadedAt: Date.now(),
      imageId: imageFile.id,
      // Add default grid settings if not stored elsewhere
      requestedTiles: 100,
      actualTiles: 100,
      tileSize: 50,
      cols: 16,
      rows: 9,
    }

    console.log("✅ Main image loaded successfully")

    return NextResponse.json({
      mainImage: mainImageData,
      success: true,
    })
  } catch (error: any) {
    console.error("❌ Error fetching main image:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, requiresAuth: true }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch main image" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const mainImageFolderId = process.env.GOOGLE_DRIVE_MAIN_IMAGE_FOLDER_ID
    if (!mainImageFolderId) {
      return NextResponse.json(
        {
          error: "Main image folder not configured. Please set GOOGLE_DRIVE_MAIN_IMAGE_FOLDER_ID environment variable.",
        },
        { status: 500 },
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Authentication required", requiresAuth: true }, { status: 401 })
    }

    const body = await request.json()
    const { dataUrl, filename, minTiles } = body
    const imageData = dataUrl // Map dataUrl to imageData for consistency
    const requestedTiles = minTiles || 100 // Map minTiles to requestedTiles with default

    if (!imageData || !filename) {
      return NextResponse.json({ error: "Missing image data or filename" }, { status: 400 })
    }

    console.log("📤 Uploading main image to folder:", mainImageFolderId)

    // Clear existing main images first
    try {
      const existingFiles = await listFiles(mainImageFolderId)
      for (const file of existingFiles) {
        if (file.id) {
          await deleteFile(file.id)
          console.log("🗑️ Deleted existing main image:", file.name)
        }
      }
    } catch (deleteError) {
      console.warn("⚠️ Could not clear existing main images:", deleteError)
    }

    // Upload new main image
    const fileId = await uploadFile(imageData, filename, mainImageFolderId)

    console.log("✅ Main image uploaded successfully:", fileId)

    return NextResponse.json({
      success: true,
      fileId,
      message: "Main image uploaded successfully",
    })
  } catch (error: any) {
    console.error("❌ Error uploading main image:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, requiresAuth: true }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload main image" },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    const mainImageFolderId = process.env.GOOGLE_DRIVE_MAIN_IMAGE_FOLDER_ID
    if (!mainImageFolderId) {
      return NextResponse.json({ error: "Main image folder not configured" }, { status: 500 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Authentication required", requiresAuth: true }, { status: 401 })
    }

    console.log("🗑️ Deleting main images from folder:", mainImageFolderId)

    const files = await listFiles(mainImageFolderId)
    let deletedCount = 0

    for (const file of files) {
      if (file.id) {
        await deleteFile(file.id)
        deletedCount++
        console.log("🗑️ Deleted main image:", file.name)
      }
    }

    console.log(`✅ Deleted ${deletedCount} main images`)

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} main images`,
    })
  } catch (error: any) {
    console.error("❌ Error deleting main images:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, requiresAuth: true }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete main images" },
      { status: 500 },
    )
  }
}
