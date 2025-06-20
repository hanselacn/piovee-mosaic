import { google } from "googleapis"
import { Readable } from "stream"
import { drive_v3 } from "googleapis"

// Type for file metadata response
interface GoogleDriveFile {
  id: string
  name: string
  createdTime?: string
  size?: string
}

// Initialize Google Drive API with service account
function getDriveService(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  return google.drive({ version: "v3", auth })
}

// Check if service account is properly configured
export function isServiceAccountConfigured(): boolean {
  return !!(
    process.env.GOOGLE_PROJECT_ID &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_CLIENT_EMAIL &&
    process.env.GOOGLE_CLIENT_ID
  )
}

// Find or create a folder in Google Drive
export async function findOrCreateFolder(folderName: string): Promise<string> {
  const drive = getDriveService()

  console.log(`📁 Looking for folder: ${folderName}`)

  try {
    // First, try to find existing folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    })

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id!
      console.log(`✅ Found existing folder: ${folderName} (${folderId})`)
      return folderId
    }

    // Create new folder if not found
    console.log(`📁 Creating new folder: ${folderName}`)
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    })

    const folderId = createResponse.data.id!
    console.log(`✅ Created new folder: ${folderName} (${folderId})`)
    return folderId
  } catch (error) {
    console.error(`❌ Error with folder operation:`, error)
    throw error
  }
}

// Upload a photo to Google Drive
export async function uploadPhotoWithServiceAccount(
  base64Data: string,
  fileName: string,
  folderId: string,
): Promise<string> {
  const drive = getDriveService()

  console.log(`📤 Uploading photo: ${fileName}`)

  try {
    // Convert base64 to buffer
    const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, "")
    const buffer = Buffer.from(base64Content, "base64")

    // Create readable stream from buffer
    const stream = new Readable({
      read() {
        this.push(buffer)
        this.push(null)
      },
    })

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: "image/jpeg",
        body: stream,
      },
      fields: "id, name, createdTime",
    })

    console.log(`✅ Photo uploaded: ${fileName} (${response.data.id})`)
    return response.data.id!
  } catch (error) {
    console.error(`❌ Error uploading photo:`, error)
    throw error
  }
}

// List files in a Google Drive folder
export async function listFilesWithServiceAccount(folderId: string): Promise<GoogleDriveFile[]> {
  const drive = getDriveService()

  console.log(`📂 Listing files in folder: ${folderId}`)

  try {
    // List files in folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "files(id, name, createdTime, size)",
      orderBy: "createdTime desc",
    })

    const files = response.data.files || []
    console.log(`📂 Found ${files.length} files in ${folderId}`)

    return files as GoogleDriveFile[]
  } catch (error) {
    console.error(`❌ Error listing files:`, error)
    throw error
  }
}

// Get file content using service account
export async function getFileContentWithServiceAccount(fileId: string): Promise<string> {
  const drive = getDriveService()
  console.log(`📥 Getting content for file: ${fileId}`)

  try {
    // Get file content with responseType 'arraybuffer'
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      {
        responseType: "arraybuffer",
      },
    )

    // Convert response to base64
    const buffer = Buffer.from(response.data as ArrayBuffer)
    const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`

    console.log(`✅ Got file content, size: ${buffer.length} bytes`)
    return base64
  } catch (error) {
    console.error(`❌ Error getting file content:`, error)
    throw error
  }
}

// Clear all files in a folder
export async function clearFolderWithServiceAccount(folderId: string): Promise<{
  deletedCount: number
}> {
  const drive = getDriveService()

  console.log(`🗑️ Clearing folder: ${folderId}`)

  try {
    // Get all files in folder
    const files = await listFilesWithServiceAccount(folderId)
    let deletedCount = 0

    // Delete each file
    for (const file of files) {
      try {
        await drive.files.delete({
          fileId: file.id,
        })
        console.log(`🗑️ Deleted: ${file.name}`)
        deletedCount++
      } catch (error) {
        console.error(`❌ Failed to delete ${file.name}:`, error)
      }
    }

    console.log(`✅ Deleted ${deletedCount} files from ${folderId}`)
    return { deletedCount }
  } catch (error) {
    console.error(`❌ Error clearing folder:`, error)
    throw error
  }
}

// Delete a specific file from Google Drive
export async function deleteFileWithServiceAccount(fileId: string): Promise<void> {
  const drive = getDriveService()

  try {
    console.log(`🗑️ Deleting file: ${fileId}`)
    
    await drive.files.delete({
      fileId: fileId,
    })
    
    console.log(`✅ File deleted successfully: ${fileId}`)
  } catch (error) {
    console.error(`❌ Error deleting file ${fileId}:`, error)
    throw error
  }
}
