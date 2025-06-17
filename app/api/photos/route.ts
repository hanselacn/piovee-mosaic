import { type NextRequest, NextResponse } from "next/server"
import { createFolderIfNotExists, uploadFile, listFiles } from "@/lib/google-drive"
import path from "path"

const FOLDER_NAME = "Mosaic App"
const PHOTOS_PREFIX = "photo-"

export async function GET() {
  try {
    // Get or create folder ID
    let folderId: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      const newFolderId = await createFolderIfNotExists(FOLDER_NAME);
      if (!newFolderId) {
        throw new Error("Failed to get or create folder");
      }
      folderId = newFolderId;
    }

    // List all files in the folder
    const files = await listFiles(folderId);

    // Filter to get only photos (not the main image)
    const photos = files.filter((file) => file.name?.startsWith(PHOTOS_PREFIX));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error("Error getting photos:", error);
    return NextResponse.json({ error: "Failed to get photos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    // Get or create folder ID
    let folderId: string | undefined = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      const newFolderId = await createFolderIfNotExists(FOLDER_NAME);
      if (!newFolderId) {
        throw new Error("Failed to get or create folder");
      }
      folderId = newFolderId;
    }

    // Generate a unique filename with timestamp
    const timestamp = new Date().getTime();
    const fileName = `${PHOTOS_PREFIX}${timestamp}.jpg`;

    // Upload the photo
    const file = await uploadFile(imageData, fileName, folderId);

    return NextResponse.json({
      success: true,
      id: file.id,
      message: "Photo uploaded successfully",
    });
  } catch (error) {
    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { error: "Failed to upload photo", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // For production, you might want to implement actual file deletion from Google Drive
    // For now, we'll just return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting photos:", error);
    return NextResponse.json({ error: "Failed to delete photos" }, { status: 500 });
  }
}
