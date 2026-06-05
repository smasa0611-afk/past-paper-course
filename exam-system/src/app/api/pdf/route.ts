import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let rawPath = searchParams.get("path");
    
    if (!rawPath) {
      console.error("PDF API Error: No path query parameter specified");
      return NextResponse.json({ error: 'No path specified' }, { status: 400 });
    }

    // Remove any leading slashes to prevent path.join from treating it as an absolute path
    while (rawPath.startsWith('/')) {
      rawPath = rawPath.substring(1);
    }
    
    const decodedPath = decodeURIComponent(rawPath);
    console.log("PDF API Requested path:", decodedPath);
    
    if (!decodedPath) {
      console.error("PDF API Error: No path specified");
      return NextResponse.json({ error: 'No path specified' }, { status: 400 });
    }

    if (
      decodedPath.includes("..") ||
      decodedPath.includes("\\") ||
      !decodedPath.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    return NextResponse.redirect(new URL(`/exam-assets/${decodedPath}`, request.url));
  } catch (error) {
    console.error("Error serving pdf:", error);
    return NextResponse.json({ error: 'Failed to serve pdf' }, { status: 500 });
  }
}
