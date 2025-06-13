import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { Readable } from "stream"

function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable()
  readable.push(buffer)
  readable.push(null)
  return readable
}

export async function createFolderIfNotExists(folderName: string, parentFolderId?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    // Check if folder already exists
    const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const searchQuery = parentFolderId ? `${query} and '${parentFolderId}' in parents` : query

    const response = await drive.files.list({
      q: searchQuery,
      fields: "files(id, name)",
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!
    }

    // Create folder if it doesn't exist
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    }

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
    })

    return folder.data.id!
  } catch (error) {
    console.error("Error creating/finding folder:", error)
    throw new Error(`Failed to create/find folder: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function uploadFile(base64Data: string, fileName: string, folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Content, "base64")
    const stream = bufferToStream(buffer)

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    }

    const media = {
      mimeType: "image/jpeg",
      body: stream,
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    })

    return response.data.id!
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error)
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function getFileUrl(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
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

    // Return the direct view URL
    return `https://drive.google.com/uc?id=${fileId}`
  } catch (error) {
    console.error("Error getting file URL:", error)
    throw new Error(`Failed to get file URL: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function listFiles(folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, createdTime, webViewLink)",
      orderBy: "createdTime desc",
    })

    return response.data.files || []
  } catch (error) {
    console.error("Error listing files:", error)
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function deleteFile(fileId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: session.accessToken })

  const drive = google.drive({ version: "v3", auth })

  try {
    await drive.files.delete({
      fileId: fileId,
    })

    return true
  } catch (error) {
    console.error("Error deleting file:", error)
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Alternative multipart upload function as a fallback
export async function uploadFileMultipart(base64Data: string, fileName: string, folderId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    throw new Error("No access token found")
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

    const request = {
      method: "POST",
      headers: {
        "Content-Type": 'multipart/related; boundary="' + boundary + '"',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: multipartRequestBody,
    }

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", request)

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }

    const result = await response.json()
    return result.id
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error)
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
