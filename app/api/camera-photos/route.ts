import { NextResponse } from "next/server"
import { getFileContentWithServiceAccount, isServiceAccountConfigured } from "@/lib/google-service-account"

// Use the specific Camera Photos folder ID
const CAMERA_PHOTOS_FOLDER_ID = "1xRKxbsGbIATgMo_33vBg-SbB0VUdnGVb"

export async function GET() {
  try {
    console.log("📸 Fetching camera photos from specific folder...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Get files from the specific Camera Photos folder
    const files = await listFilesFromFolder(CAMERA_PHOTOS_FOLDER_ID)

    console.log(`📷 Found ${files.length} files in Camera Photos folder`)

    if (files.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    // Get content for each photo
    const photos = []
    for (const file of files) {
      try {
        console.log(`📥 Loading photo: ${file.name}`)
        const photoData = await getFileContentWithServiceAccount(file.id!)

        photos.push({
          id: file.id,
          fileName: file.name,
          photoData,
          timestamp: new Date(file.createdTime || Date.now()).getTime(),
          createdTime: file.createdTime,
        })
      } catch (error) {
        console.error(`❌ Error loading photo ${file.name}:`, error)
      }
    }

    console.log(`✅ Successfully loaded ${photos.length} camera photos`)

    return NextResponse.json({
      photos,
      folderInfo: {
        folderId: CAMERA_PHOTOS_FOLDER_ID,
        folderName: "Camera Photos",
        totalFiles: files.length,
      },
    })
  } catch (error) {
    console.error("❌ Error fetching camera photos:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch camera photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    console.log("🗑️ Clearing camera photos from specific folder...")

    // Check if service account is configured
    if (!isServiceAccountConfigured()) {
      console.error("❌ Service account not configured")
      return NextResponse.json({ error: "Service account not configured" }, { status: 503 })
    }

    // Clear the specific Camera Photos folder
    const result = await clearFolderFromFolderId(CAMERA_PHOTOS_FOLDER_ID)

    console.log(`✅ Cleared ${result.deletedCount} camera photos`)

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Cleared ${result.deletedCount} photos from Camera Photos folder`,
    })
  } catch (error) {
    console.error("❌ Error clearing camera photos:", error)
    return NextResponse.json(
      {
        error: "Failed to clear camera photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Helper function to list files from specific folder ID
async function listFilesFromFolder(folderId: string): Promise<any[]> {
  const { google } = await import("googleapis")

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  const drive = google.drive({ version: "v3", auth })

  console.log(`📂 Listing files in folder: ${folderId}`)

  // List files in the specific folder
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: "files(id, name, createdTime, size)",
    orderBy: "createdTime desc",
  })

  const files = response.data.files || []
  console.log(`📂 Found ${files.length} files in Camera Photos folder`)

  return files
}

// Helper function to clear specific folder by ID
async function clearFolderFromFolderId(folderId: string): Promise<{ deletedCount: number }> {
  const { google } = await import("googleapis")

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  const drive = google.drive({ version: "v3", auth })

  console.log(`🗑️ Clearing folder: ${folderId}`)

  // Get all files in folder
  const files = await listFilesFromFolder(folderId)

  let deletedCount = 0

  // Delete each file
  for (const file of files) {
    try {
      await drive.files.delete({
        fileId: file.id!,
      })
      console.log(`🗑️ Deleted: ${file.name}`)
      deletedCount++
    } catch (error) {
      console.error(`❌ Failed to delete ${file.name}:`, error)
    }
  }

  console.log(`✅ Deleted ${deletedCount} files from Camera Photos folder`)
  return { deletedCount }
}
