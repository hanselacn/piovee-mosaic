import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import {
  createFolderIfNotExists,
  uploadFile,
  getFileContent,
  getPublicUrl,
  listFiles,
  deleteFile,
  AuthenticationError,
} from "@/lib/google-drive"

const FOLDER_NAME = "Mosaic App"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // Create or get the Mosaic App folder
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await createFolderIfNotExists(FOLDER_NAME))

    // Delete existing main images first
    const existingFiles = await listFiles(folderId)
    const mainImageFiles = existingFiles.filter((file) => file.name?.startsWith("main-image-"))

    for (const file of mainImageFiles) {
      if (file.id) {
        try {
          await deleteFile(file.id)
          console.log(`Deleted existing main image: ${file.name}`)
        } catch (error) {
          console.error(`Error deleting existing main image ${file.id}:`, error)
        }
      }
    }

    // Clear all collage photos when uploading new main image
    try {
      const clearResponse = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/collage-photos`, {
        method: "DELETE",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      })

      if (clearResponse.ok) {
        console.log("Cleared existing collage photos")
      } else {
        console.error("Failed to clear collage photos:", await clearResponse.text())
      }
    } catch (error) {
      console.error("Error clearing collage photos:", error)
    }

    // Generate a unique filename
    const fileName = `main-image-${Date.now()}.jpg`

    // Upload using the direct HTTP approach
    const fileId = await uploadFile(imageData, fileName, folderId)

    // Make the file public and get URLs
    const urls = await getPublicUrl(fileId)

    return NextResponse.json({
      success: true,
      fileId,
      urls,
      message: "Main image uploaded successfully and collage photos cleared",
    })
  } catch (error) {
    console.error("Error uploading main image:", error)

    // Handle authentication errors specifically
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          message: "Your session has expired. Please sign in again.",
          requiresAuth: true,
        },
        { status: 401 },
      )
    }

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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await createFolderIfNotExists(FOLDER_NAME))

    // List files to find the most recent main image
    const files = await listFiles(folderId)
    const mainImage = files.find((file) => file.name?.startsWith("main-image-"))

    if (!mainImage || !mainImage.id) {
      return NextResponse.json({ mainImage: null })
    }

    // Get the image content
    const dataUrl = await getFileContent(mainImage.id)

    return NextResponse.json({
      mainImage: {
        id: mainImage.id,
        name: mainImage.name,
        dataUrl,
      },
    })
  } catch (error) {
    console.error("Error getting main image:", error)

    // Handle authentication errors specifically
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        {
          error: "Authentication failed",
          message: "Your session has expired. Please sign in again.",
          requiresAuth: true,
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      { error: "Failed to get main image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
