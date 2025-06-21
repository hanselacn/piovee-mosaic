import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  // Get the pathname
  const path = request.nextUrl.pathname

  // Handle CORS for API routes
  if (path.startsWith('/api')) {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  }

  // Define public paths that don't require authentication
  const isPublicPath =
    path.startsWith("/auth") ||
    path.startsWith("/camera") ||
    path.startsWith("/upload") ||
    path === "/" ||
    path === "/api/websocket-proxy" ||
    path === "/api/collage-photos" ||
    path === "/api/main-image" ||
    path === "/api/camera-photos" ||
    path === "/api/upload-photo" ||
    path === "/api/camera-auth" ||
    path === "/api/mosaic-photos" ||
    path === "/api/test-pusher" ||
    path === "/api/health"

  // Get the token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Redirect logic - only for non-public paths
  if (!token && !isPublicPath) {
    const url = new URL("/auth/signin", request.url)
    url.searchParams.set("callbackUrl", encodeURI(request.url))
    return NextResponse.redirect(url)
  }

  // Add CORS headers to API responses
  if (path.startsWith('/api')) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }

  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|camera-shutter.mp3).*)"],
}
