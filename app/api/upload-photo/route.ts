import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { uploadFile, createFolderIfNotExists, AuthenticationError } from "@/lib/google-drive"

export async function POST(request: NextRequest) {
  try {
    // Check authentication first
    const session = await getServerSession(authOptions)
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Authentication required", requiresAuth: true }, { status: 401 })
    }

    console.log("📤 Processing photo upload request")

    const body = await request.json()
    const { photoData, fileName } = body

    if (!photoData || !fileName) {
      return NextResponse.json({ error: "Missing photo data or filename" }, { status: 400 })
    }

    console.log("📁 Creating/finding camera photos folder")

    // Create or get the camera photos folder
    const folderId = await createFolderIfNotExists("Camera Photos")
    if (!folderId) {
      throw new Error("Failed to create or find camera photos folder")
    }

    console.log("☁️ Uploading photo to Google Drive")

    // Upload the photo
    const fileId = await uploadFile(photoData, fileName, folderId)

    console.log("✅ Photo uploaded successfully:", fileId)

    return NextResponse.json({
      success: true,
      fileId,
      message: "Photo uploaded successfully",
    })
  } catch (error: any) {
    console.error("❌ Error uploading photo:", error)

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, requiresAuth: true }, { status: 401 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
