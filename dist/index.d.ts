export type OutputFormat = "jpg" | "webp";
export interface ConvertImagesOptions {
    folderPath?: string;
    quality?: number;
    untrackedFilesOnly?: boolean;
    maxSize?: number | null;
    format?: OutputFormat;
    quiet?: boolean;
    deleteOriginal?: boolean;
    recursive?: boolean;
    concurrency?: number;
}
export interface ProcessedImageResult {
    sourcePath: string;
    outputPath: string;
    originalSize: number;
    outputSize: number;
    savedBytes: number;
    savedPercent: number;
    skipped: boolean;
    reason?: string;
}
export interface ConvertImagesSummary {
    folderPath: string;
    format: OutputFormat;
    quality: number;
    maxSize: number | null;
    untrackedFilesOnly: boolean;
    concurrency: number;
    processed: number;
    skipped: number;
    totalOriginalSize: number;
    totalOutputSize: number;
    totalSavedBytes: number;
    totalSavedPercent: number;
    results: ProcessedImageResult[];
}
type Logger = (...args: unknown[]) => void;
export declare function logger(quiet: boolean): Logger;
export declare function convertImages(inputOptions?: ConvertImagesOptions): Promise<ConvertImagesSummary>;
export {};
//# sourceMappingURL=index.d.ts.map