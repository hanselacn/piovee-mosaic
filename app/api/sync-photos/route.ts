import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createFolderIfNotExists, uploadFile, AuthenticationError } from "@/lib/google-drive"

const COLLAGE_FOLDER_NAME = "collage-photos"

// POST - Sync temporary photos to Google Drive (requires auth)
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    // Get temporary photos
    const tempResponse = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/temp-photos`)
    if (!tempResponse.ok) {
      throw new Error("Failed to get temporary photos")
    }

    const tempData = await tempResponse.json()
    const tempPhotos = tempData.photos || []

    if (tempPhotos.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No temporary photos to sync",
        synced: 0,
      })
    }

    // Create or get the collage photos folder
    const folderId = await createFolderIfNotExists(COLLAGE_FOLDER_NAME)

    // Upload each temporary photo to Google Drive
    const results = []
    for (const photo of tempPhotos) {
      try {
        console.log(`📤 Syncing photo ${photo.fileName} to Google Drive...`)
        const fileId = await uploadFile(photo.dataUrl, photo.fileName, folderId)

        // Remove from temporary storage after successful upload
        await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/temp-photos?id=${photo.id}`, {
          method: "DELETE",
        })

        results.push({
          success: true,
          tempId: photo.id,
          fileName: photo.fileName,
          driveFileId: fileId,
        })

        console.log(`✅ Successfully synced ${photo.fileName}`)
      } catch (error) {
        console.error(`❌ Failed to sync ${photo.fileName}:`, error)
        results.push({
          success: false,
          tempId: photo.id,
          fileName: photo.fileName,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Synced ${successful} photos to Google Drive, ${failed} failed`,
      synced: successful,
      failed,
      results,
    })
  } catch (error) {
    console.error("Error syncing photos:", error)

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
      { error: "Failed to sync photos", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
