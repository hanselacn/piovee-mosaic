import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { uploadFile, createFolderIfNotExists, uploadFileMultipart } from "@/lib/google-drive"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Create or get the Mosaic App folder
    const folderId = await createFolderIfNotExists("Mosaic App")

    // Generate a unique filename
    const fileName = `main-image-${Date.now()}.jpg`

    try {
      // Try the stream-based upload first
      const fileId = await uploadFile(image, fileName, folderId)
      return NextResponse.json({ success: true, fileId })
    } catch (streamError) {
      console.log("Stream upload failed, trying multipart upload:", streamError)

      // Fallback to multipart upload
      const fileId = await uploadFileMultipart(image, fileName, folderId)
      return NextResponse.json({ success: true, fileId })
    }
  } catch (error) {
    console.error("Error uploading main image:", error)
    return NextResponse.json(
      { error: `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // This would get the current main image
    // For now, return a placeholder response
    return NextResponse.json({ mainImage: null })
  } catch (error) {
    console.error("Error getting main image:", error)
    return NextResponse.json({ error: "Failed to get main image" }, { status: 500 })
  }
}
