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
}

export declare const TianmingFileExport: TianmingFileExportPlugin;
