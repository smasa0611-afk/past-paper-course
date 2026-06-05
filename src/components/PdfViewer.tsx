"use client";

import { useState } from "react";
import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  pagesPerRow?: 1 | 2;
  pageWidth?: number;
}

export default function PdfViewer({
  fileUrl,
  pagesPerRow = 1,
  pageWidth = 780,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  const containerClass =
    pagesPerRow === 2
      ? "grid w-max grid-cols-1 gap-6 xl:grid-cols-2"
      : "flex w-max flex-col gap-8";

  return (
    <div className="flex w-max min-w-full flex-col items-start">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        className={containerClass}
        loading={
          <div className="flex h-full items-center justify-center py-20 text-lg font-medium text-accent animate-pulse">
            PDF Loading...
          </div>
        }
        error={
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-500">
            Failed to load PDF.
          </div>
        }
      >
        {Array.from(new Array(numPages), (_, index) => (
          <div
            key={`page_${index + 1}`}
            className="relative bg-white shadow-2xl"
          >
            <Page
              pageNumber={index + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              renderMode="canvas"
              width={pageWidth}
              className="max-w-full border border-slate-200 [&_canvas]:!h-auto [&_canvas]:!max-w-full"
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
