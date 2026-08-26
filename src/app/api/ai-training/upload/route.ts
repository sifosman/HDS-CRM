import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdvisorAttachment, AdvisorAttachmentType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME: Record<string, AdvisorAttachmentType> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "application/pdf": "document",
  "text/plain": "document",
  "text/csv": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/aac": "audio",
  "audio/x-m4a": "audio",
  "audio/m4a": "audio",
  "audio/mp4": "audio",
};

/**
 * Extracts text from a document buffer based on content type.
 * Supports PDF, .docx, .txt, and .csv.
 */
async function extractDocumentText(
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  try {
    if (
      contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    }

    if (contentType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      return result.text || null;
    }

    if (contentType === "text/plain" || contentType === "text/csv") {
      return buffer.toString("utf-8");
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const sessionId = formData.get("sessionId");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Session ID required" }, { status: 400 });
  }

  // Verify the session belongs to this owner
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("ai_training_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
      { status: 413 },
    );
  }

  // Validate and classify file type
  const contentType = file.type || "application/octet-stream";
  const attachmentType = ALLOWED_MIME[contentType];

  if (!attachmentType) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${contentType}. Supported: images (PNG, JPEG, GIF, WebP), documents (PDF, DOCX, TXT, CSV), audio (MP3, WAV, WebM, OGG, AAC, M4A)`,
      },
      { status: 415 },
    );
  }

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract text for documents
  let extractedText: string | undefined;
  if (attachmentType === "document") {
    const text = await extractDocumentText(buffer, contentType);
    if (text) {
      // Truncate to a reasonable length to avoid blowing up the context
      extractedText = text.slice(0, 50000);
    } else {
      extractedText = "[Could not extract text from this document. The AI may not be able to read it.]";
    }
  }

  // Generate a unique storage path: {owner_id}/{session_id}/{uuid}.{ext}
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${sessionId}/${fileId}.${ext}`;

  // Upload to Supabase Storage (admin client bypasses RLS; security is
  // enforced at the application layer — auth, role, and session ownership
  // are all verified above).
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from("ai-training-attachments")
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const attachment: AdvisorAttachment = {
    id: fileId,
    filename: file.name,
    contentType,
    size: file.size,
    storagePath,
    type: attachmentType,
    ...(extractedText ? { extractedText } : {}),
  };

  return NextResponse.json({ attachment });
}
