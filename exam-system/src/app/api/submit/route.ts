import { NextResponse } from 'next/server';
import { createSubmissionId, submissionExists, writeSubmissionBuffer, writeSubmissionText } from "@/lib/submission-storage";
import { requireSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const session = await requireSession("student");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const formData = await req.formData();
    const examId = formData.get('examId') as string;
    const requestedSubmissionId = formData.get('submissionId') as string | null;
    const content = formData.get('content') as string;
    const timestamp = (formData.get('timestamp') as string) || new Date().toISOString();
    const studentId = session.user.id;
    const imageFiles = formData.getAll('images') as File[];
    
    if (!examId) {
      return NextResponse.json({ error: 'Missing examId' }, { status: 400 });
    }

    let submissionId = requestedSubmissionId || createSubmissionId(studentId);
    if (await submissionExists(examId, submissionId)) {
      do {
        submissionId = createSubmissionId(studentId);
      } while (await submissionExists(examId, submissionId));
    }
    
    const savedImages: string[] = [];

    // Save uploaded image files
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      if (file && file.size > 0) {
        // get extension from file type or name
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `image_${i + 1}.${ext}`;
        
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writeSubmissionBuffer(examId, submissionId, fileName, buffer, file.type || "application/octet-stream");
        savedImages.push(fileName);
      }
    }
    
    const submissionData = {
      id: submissionId,
      examId,
      studentId,
      content: content || "",
      images: savedImages,
      timestamp,
      status: 'pending' // pending | graded
    };
    
    // Save submission data as JSON
    await writeSubmissionText(
      examId,
      submissionId,
      "submission.json",
      JSON.stringify(submissionData, null, 2),
      "application/json",
    );
    
    return NextResponse.json({ success: true, submissionId });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }
}
