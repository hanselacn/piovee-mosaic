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

// Upload file using service account
export async function uploadFileWithServiceAccount(base64Data: string, fileName: string, folderName = "Mosaic Photos") {
  try {
    console.log("🔧 Attempting service account upload...")

    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured. Please set up Google Service Account environment variables.")
    }

    const drive = google.drive({ version: "v3", auth })

    // Create or find the folder
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!folderId) {
      console.log("📁 Creating new folder...")
      const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: "id",
      })

      folderId = folder.data.id!
      console.log(`📁 Created folder with ID: ${folderId}`)
    }

    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "")

    // Create multipart body for upload
    const boundary = "-------314159265358979323846"
    const delimiter = "\r\n--" + boundary + "\r\n"
    const close_delim = "\r\n--" + boundary + "--"

    const metadata = {
      name: fileName,
      parents: [folderId],
    }

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: image/jpeg\r\n" +
      "Content-Transfer-Encoding: base64\r\n" +
      "\r\n" +
      base64Content +
      close_delim

    // Get access token
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    if (!accessToken.token) {
      throw new Error("Failed to get access token from service account")
    }

    // Upload file
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary="${boundary}"`,
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: multipartRequestBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log("✅ Service account upload successful:", result.id)

    return {
      success: true,
      fileId: result.id,
      fileName: fileName,
      folderId: folderId,
    }
  } catch (error) {
    console.error("❌ Service account upload failed:", error)
    throw error
  }
}

// List files in folder using service account
export async function listFilesWithServiceAccount(folderName = "Mosaic Photos") {
  try {
    const auth = createServiceAuth()
    if (!auth) {
      throw new Error("Service account not configured")
    }

    const drive = google.drive({ version: "v3", auth })

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) {
      return []
    }

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, createdTime, webContentLink)",
      orderBy: "createdTime desc",
    })

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

    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    if (!accessToken.token) {
      throw new Error("Failed to get access token")
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error("❌ Error getting file content with service account:", error)
    throw error
  }
}

// Check if service account is configured
export function isServiceAccountConfigured() {
  const requiredVars = ["GOOGLE_PROJECT_ID", "GOOGLE_PRIVATE_KEY", "GOOGLE_CLIENT_EMAIL"]
  return requiredVars.every((varName) => process.env[varName])
}
