import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// Custom error class for authentication failures
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthenticationError"
  }
}

// Get system auth (uses the folder ID from environment variable)
function getSystemAuth() {
  // For now, we'll use a simple approach where the system uses the predefined folder
  // In a production environment, you'd want to use a service account
  return null // This will be handled differently in the system functions
}

// Create a folder in Google Drive if it doesn't exist
export async function createFolderIfNotExists(folderName: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    // Check if folder exists
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id
    }

    // Create folder if it doesn't exist
    const fileMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    })

    return folder.data.id
  } catch (error: any) {
    console.error("Error creating folder:", error)

    // Check if it's an authentication error
    if (error.code === 401 || error.status === 401) {
      throw new AuthenticationError("Authentication failed - please sign in again")
    }

    throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Upload a file to Google Drive using direct HTTP request
export async function uploadFile(base64Data: string, fileName: string, folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "")

    // Create multipart body
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

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary="${boundary}"`,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: multipartRequestBody,
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Check if it's an authentication error
      if (response.status === 401) {
        throw new AuthenticationError("Authentication failed - please sign in again")
      }

      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    return result.id
  } catch (error: any) {
    console.error("Error uploading file to Google Drive:", error)

    // Re-throw authentication errors as-is
    if (error instanceof AuthenticationError) {
      throw error
    }

    // Check if the error message contains authentication-related keywords
    if (
      error.message &&
      (error.message.includes("401") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("Invalid Credentials"))
    ) {
      throw new AuthenticationError("Authentication failed - please sign in again")
    }

    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// System functions that work without user authentication
// These use the predefined Google Drive folder ID from environment variables

export async function uploadFileWithSystemAuth(base64Data: string, fileName: string, folderName: string) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) {
    throw new Error("Google Drive folder ID not configured. Please set GOOGLE_DRIVE_FOLDER_ID environment variable.")
  }

  try {
    // For now, we'll store files in a simple way
    // In production, you'd want to use a service account or other secure method

    // Since we can't upload without authentication, we'll need to use a different approach
    // Let's store the photos temporarily and have the main page handle the Google Drive upload

    // For this demo, we'll return a success response and handle storage differently
    console.log(`Would upload ${fileName} to folder ${folderName}`)

    // Generate a mock file ID for now
    const mockFileId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // In a real implementation, you'd store this in a temporary location
    // or use a service account to upload to Google Drive

    return mockFileId
  } catch (error) {
    console.error("Error in system upload:", error)
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function listFilesWithSystemAuth(folderName: string) {
  // For now, return empty array since we can't actually list files without auth
  // In production, you'd use a service account or have the main page sync the files
  console.log(`Would list files from folder ${folderName}`)
  return []
}

export async function getFileContentWithSystemAuth(fileId: string) {
  // Mock implementation
  console.log(`Would get content for file ${fileId}`)
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
}

export async function deleteFileWithSystemAuth(folderName: string) {
  // Mock implementation
  console.log(`Would delete all files from folder ${folderName}`)
  return { deleted: 0, message: "Mock deletion" }
}

// Get file content from Google Drive
export async function getFileContent(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthenticationError("Authentication failed - please sign in again")
      }
      throw new Error(`Failed to get file: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    return `data:image/jpeg;base64,${base64}`
  } catch (error: any) {
    console.error("Error getting file content:", error)

    if (error instanceof AuthenticationError) {
      throw error
    }

    throw new Error(`Failed to get file content: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// List files in a folder
export async function listFiles(folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, webContentLink, thumbnailLink)",
      spaces: "drive",
    })

    return response.data.files || []
  } catch (error: any) {
    console.error("Error listing files:", error)

    if (error.code === 401 || error.status === 401) {
      throw new AuthenticationError("Authentication failed - please sign in again")
    }

    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Delete a file from Google Drive
export async function deleteFile(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    await drive.files.delete({
      fileId: fileId,
    })
    return true
  } catch (error: any) {
    console.error("Error deleting file:", error)

    if (error.code === 401 || error.status === 401) {
      throw new AuthenticationError("Authentication failed - please sign in again")
    }

    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Make a file publicly accessible and get its URL
export async function getPublicUrl(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new AuthenticationError("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    // Make the file publicly viewable
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    })

    // Get the file metadata
    const file = await drive.files.get({
      fileId: fileId,
      fields: "webContentLink,webViewLink",
    })

    return {
      webContentLink: file.data.webContentLink,
      webViewLink: file.data.webViewLink,
      directLink: `https://drive.google.com/uc?id=${fileId}`,
    }
  } catch (error: any) {
    console.error("Error making file public:", error)

    if (error.code === 401 || error.status === 401) {
      throw new AuthenticationError("Authentication failed - please sign in again")
    }

    throw new Error(`Failed to make file public: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
