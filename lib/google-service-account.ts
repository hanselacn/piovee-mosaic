import { google } from "googleapis"
import { Readable } from "stream"

// Initialize Google Drive API
function getDriveService() {
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

  return google.drive({ version: "v3", auth })
}

// Check if service account is properly configured
export function isServiceAccountConfigured(): boolean {
  return !!(process.env.GOOGLE_PROJECT_ID && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL)
}

// Find or create a folder
export async function findOrCreateFolder(folderName: string): Promise<string> {
  const drive = getDriveService()

  console.log(`📁 Looking for folder: ${folderName}`)

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
}

// Upload a photo to Google Drive
export async function uploadPhotoWithServiceAccount(
  base64Data: string,
  fileName: string,
  folderName = "Mosaic Camera Photos",
): Promise<string> {
  const drive = getDriveService()

  console.log(`📤 Uploading photo: ${fileName}`)

  // Get or create folder
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await findOrCreateFolder(folderName))

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
}

// Upload a photo to Google Drive
export async function uploadcollagePhotoWithServiceAccount(
  base64Data: string,
  fileName: string,
  folderName = "Mosaic Camera Photos",
): Promise<string> {
  const drive = getDriveService()

  console.log(`📤 Uploading photo: ${fileName}`)

  // Get or create folder
  const folderId = (await findOrCreateFolder(folderName))

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
}

// List files in a folder
export async function listFilesWithServiceAccount(folderName = "Mosaic Camera Photos"): Promise<any[]> {
  const drive = getDriveService()

  console.log(`📂 Listing files in folder: ${folderName}`)

  // Get folder ID
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || (await findOrCreateFolder(folderName))

  // List files in folder
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
    fields: "files(id, name, createdTime, size)",
    orderBy: "createdTime desc",
  })

  const files = response.data.files || []
  console.log(`📂 Found ${files.length} files in ${folderName}`)

  return files
}

// Get file content using service account - FIXED VERSION
export async function getFileContentWithServiceAccount(fileId: string): Promise<string> {
  try {
    console.log(`📥 Getting content for file: ${fileId}`)

    const drive = getDriveService()

    // Get file content with responseType 'stream'
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      {
        responseType: "arraybuffer",
      },
    )

    console.log(`📥 Response received, type: ${typeof response.data}`)

    // Convert response to buffer
    const buffer = Buffer.from(response.data as ArrayBuffer)
    const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`

    console.log(`✅ Got file content, size: ${buffer.length} bytes`)
    return base64
  } catch (error) {
    console.error(`❌ Error getting file content for ${fileId}:`, error)
    throw error
  }
}

// Clear all files in a folder
export async function clearFolderWithServiceAccount(folderName = "Mosaic Camera Photos"): Promise<{
  deletedCount: number
}> {
  const drive = getDriveService()

  console.log(`🗑️ Clearing folder: ${folderName}`)

  // Get all files in folder
  const files = await listFilesWithServiceAccount(folderName)

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

  console.log(`✅ Deleted ${deletedCount} files from ${folderName}`)
  return { deletedCount }
}
