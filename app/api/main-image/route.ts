import { type NextRequest, NextResponse } from "next/server"
import { createFolderIfNotExists, uploadFile, getFileContent, listFiles } from "@/lib/google-drive"

const FOLDER_NAME = "Mosaic App"
const MAIN_IMAGE_NAME = "main-image.jpg"

export async function GET() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await createFolderIfNotExists(FOLDER_NAME))

    // List files to find main image
    const files = await listFiles(folderId)
    const mainImage = files.find((file) => file.name === MAIN_IMAGE_NAME)

    if (!mainImage) {
      return NextResponse.json({ error: "Main image not found" }, { status: 404 })
    }

    // Get the image content
    const imageContent = await getFileContent(mainImage.id!)

    return NextResponse.json({
      imageData: `data:image/jpeg;base64,${imageContent}`,
      id: mainImage.id,
    })
  } catch (error) {
    console.error("Error getting main image:", error)
    return NextResponse.json({ error: "Failed to get main image" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await createFolderIfNotExists(FOLDER_NAME))

    // Upload the main image
    const file = await uploadFile(imageData, MAIN_IMAGE_NAME, folderId)

    return NextResponse.json({
      success: true,
      id: file.id,
      message: "Main image uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading main image:", error)
    return NextResponse.json({ error: "Failed to upload main image" }, { status: 500 })
  }
}
