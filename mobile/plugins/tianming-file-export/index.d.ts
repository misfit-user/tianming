export interface FileExportResult {
  saved: boolean;
  cancelled: boolean;
  fileName?: string;
  uri?: string;
}

export interface TianmingFileExportPlugin {
  /** Opens Android's Save As dialog and writes text as UTF-8 after selection. */
  saveFile(options: {
    fileName: string;
    data: string;
    mimeType?: string;
  }): Promise<FileExportResult>;
  /**
   * Chunked variant (2026-10-14): the whole save never crosses the bridge in one message.
   * beginExport opens a temp file in the app cache; appendChunk appends UTF-8 text;
   * finishExport opens Android's Save As dialog and streams the temp file to the chosen document.
   * Older shells reject beginExport with UNIMPLEMENTED; callers fall back to saveFile.
   */
  beginExport(options: { fileName: string; mimeType?: string }): Promise<{ started: boolean }>;
  appendChunk(options: { chunk: string }): Promise<{ bytes: number }>;
  finishExport(options?: Record<string, never>): Promise<FileExportResult>;
  cancelExport(options?: Record<string, never>): Promise<{ cancelled: boolean }>;
}

export declare const TianmingFileExport: TianmingFileExportPlugin;
