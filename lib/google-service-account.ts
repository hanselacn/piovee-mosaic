import { google } from "googleapis"

// Google Service Account configuration
// In production, these would be environment variables
const SERVICE_ACCOUNT_CONFIG = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
}

// Create service account auth
function createServiceAuth() {
  try {
    // Check if all required environment variables are present
    const requiredVars = ["GOOGLE_PROJECT_ID", "GOOGLE_PRIVATE_KEY", "GOOGLE_CLIENT_EMAIL"]
    const missingVars = requiredVars.filter((varName) => !process.env[varName])

    if (missingVars.length > 0) {
      console.log(`⚠️ Missing service account environment variables: ${missingVars.join(", ")}`)
      return null
    }

    const auth = new google.auth.GoogleAuth({
      credentials: SERVICE_ACCOUNT_CONFIG,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    })

    return auth
  } catch (error) {
    console.error("❌ Error creating service account auth:", error)
    return null
  }
}

// Find or create folder
async function findOrCreateFolder(drive: any, folderName: string) {
  try {
    console.log(`📁 Looking for folder: ${folderName}`)

    // First, try to find existing folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
    })

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      const folderId = searchResponse.data.files[0].id
      console.log(`✅ Found existing folder: ${folderId}`)
      return folderId
    }

    // If not found, create new folder
    console.log(`📁 Creating new folder: ${folderName}`)
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
    })

    const folderId = folder.data.id
    console.log(`✅ Created new folder: ${folderId}`)

    return folderId
  } catch (error) {
    console.error("❌ Error finding/creating folder:", error)
    throw error
  }
}

// Upload file using service account
export async function uploadFileWithServiceAccount(
  base64Data: string,
  fileName: string,
  folderName = "Mosaic Camera Photos",
) {
  try {
    console.log("🔧 Attempting service account upload...")

    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured. Please set up Google Service Account environment variables.")
    }

    const drive = google.drive({ version: "v3", auth })

    // Find or create the folder (don't rely on environment variable)
    const folderId = await findOrCreateFolder(drive, folderName)

    if (!folderId) {
      throw new Error("Failed to create or find folder")
    }

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "")

    // Convert base64 to buffer for upload
    const buffer = Buffer.from(base64Content, "base64")

    console.log(`📁 Uploading ${fileName} to folder ${folderId}...`)

    // Upload file using the simpler files.create method
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    }

    const media = {
      mimeType: "image/jpeg",
      body: buffer,
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, parents",
    })

    console.log("✅ Service account upload successful:", response.data)

    return {
      success: true,
      fileId: response.data.id,
      fileName: fileName,
      folderId: folderId,
    }
  } catch (error) {
    console.error("❌ Service account upload failed:", error)
    throw error
  }
}

// List files in folder using service account
export async function listFilesWithServiceAccount(folderName = "Mosaic Camera Photos") {
  try {
    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured")
    }

    const drive = google.drive({ version: "v3", auth })

    // Find the folder first
    const folderId = await findOrCreateFolder(drive, folderName)

    if (!folderId) {
      console.log("📁 No folder found, returning empty list")
      return []
    }

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
      fields: "files(id, name, createdTime, webContentLink)",
      orderBy: "createdTime desc",
    })

    console.log(`📁 Found ${response.data.files?.length || 0} files in folder`)
    return response.data.files || []
  } catch (error) {
    console.error("❌ Error listing files with service account:", error)
    return []
  }
}

// Get file content using service account
export async function getFileContentWithServiceAccount(fileId: string) {
  try {
    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured")
    }

    const drive = google.drive({ version: "v3", auth })

    // Get file content
    const response = await drive.files.get({
      fileId: fileId,
      alt: "media",
    })

    // Convert response to base64
    const buffer = Buffer.from(response.data as any, "binary")
    const base64 = buffer.toString("base64")
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error("❌ Error getting file content with service account:", error)
    throw error
  }
}

// Delete all files in folder (for clearing photos when new main image is uploaded)
export async function clearFolderWithServiceAccount(folderName = "Mosaic Camera Photos") {
  try {
    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured")
    }

    const drive = google.drive({ version: "v3", auth })

    // Find the folder
    const folderId = await findOrCreateFolder(drive, folderName)
    if (!folderId) {
      console.log("📁 No folder found to clear")
      return { deletedCount: 0 }
    }

    // List all files in folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name)",
    })

    const files = response.data.files || []
    console.log(`🗑️ Deleting ${files.length} files from folder`)

    // Delete each file
    let deletedCount = 0
    for (const file of files) {
      try {
        await drive.files.delete({
          fileId: file.id!,
        })
        deletedCount++
        console.log(`🗑️ Deleted file: ${file.name}`)
      } catch (deleteError) {
        console.error(`❌ Failed to delete file ${file.name}:`, deleteError)
      }
    }

    return { deletedCount }
  } catch (error) {
    console.error("❌ Error clearing folder with service account:", error)
    throw error
  }
}

// Check if service account is configured
export function isServiceAccountConfigured() {
  const requiredVars = ["GOOGLE_PROJECT_ID", "GOOGLE_PRIVATE_KEY", "GOOGLE_CLIENT_EMAIL"]
  return requiredVars.every((varName) => process.env[varName])
}
