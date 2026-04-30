import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

export type OutputFormat = "jpg" | "webp";

export interface ConvertImagesOptions {
  // Folder to scan.
  // Default: "/".
  folderPath?: string;
  // Image quality from 1 to 100.
  // Default: 85
  quality?: number;
  // Only process untracked git files.
  // Default: false
  untrackedFilesOnly?: boolean;
  // Maximum image dimension in pixels. null means no resizing.
  // Default: null
  maxSize?: number | null;
  // Output format.
  // Default: "jpg"
  format?: OutputFormat;
  // Suppress logs.
  // Default: false
  quiet?: boolean;
  // Delete the original file when the output format changes.
  // Default: true
  deleteOriginal?: boolean;
  // Process nested folders.
  // Default: false
  recursive?: boolean;
  // Number of images to process in parallel. Higher values are faster but use more memory.
  // Default: 1
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

type NormalizedConvertImagesOptions = Required<ConvertImagesOptions>;

type Logger = (...args: unknown[]) => void;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".tiff",
  ".tif",
  ".bmp",
  ".gif"
]);

const DEFAULT_OPTIONS: NormalizedConvertImagesOptions = {
  folderPath: "/",
  quality: 85,
  untrackedFilesOnly: false,
  maxSize: null,
  format: "jpg",
  quiet: false,
  deleteOriginal: true,
  recursive: false,
  concurrency: 1
};

export function logger(quiet: boolean): Logger {
  return quiet ? () => {} : console.log;
}

function normalizeOptions(options: ConvertImagesOptions): NormalizedConvertImagesOptions {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const quality = Number(merged.quality);

  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new Error("Quality must be an integer between 1 and 100.");
  }

  if (merged.maxSize !== null) {
    const maxSize = Number(merged.maxSize);

    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error("maxSize must be a positive integer or null.");
    }

    merged.maxSize = maxSize;
  }

  if (merged.format !== "jpg" && merged.format !== "webp") {
    throw new Error('Format must be either "jpg" or "webp".');
  }

  const concurrency = Number(merged.concurrency);

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be a positive integer.");
  }

  return {
    ...merged,
    quality,
    concurrency
  };
}

function isImageFile(filePath: string) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function outputExtension(format: OutputFormat) {
  return format === "jpg" ? ".jpg" : ".webp";
}

function getOutputPath(filePath: string, format: OutputFormat) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  return path.join(dir, `${base}${outputExtension(format)}`);
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function* walkImageFiles(folderPath: string, recursive: boolean): AsyncGenerator<string> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        yield* walkImageFiles(fullPath, recursive);
      }

      continue;
    }

    if (entry.isFile() && isImageFile(fullPath)) {
      yield fullPath;
    }
  }
}

function getUntrackedImageFiles(folderPath: string): string[] {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: folderPath,
      stdio: "pipe"
    });

    const output = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
      cwd: folderPath,
      encoding: "utf8",
      stdio: "pipe"
    });

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((relativePath) => path.resolve(folderPath, relativePath))
      .filter(isImageFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to get untracked git images: ${message}`);
  }
}

async function deleteFileWithRetry(filePath: string, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.unlink(filePath);
      return;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === "ENOENT") {
        return;
      }

      if (err.code !== "EBUSY" || attempt === maxRetries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${Number((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function processImage(
  filePath: string,
  options: NormalizedConvertImagesOptions
): Promise<ProcessedImageResult> {
  const originalStats = await fs.stat(filePath);
  const originalSize = originalStats.size;

  const outputPath = getOutputPath(filePath, options.format);
  const sameFile = path.resolve(filePath) === path.resolve(outputPath);

  const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  let pipeline = sharp(filePath, {
    failOn: "none",
    limitInputPixels: false
  }).rotate();

  if (options.maxSize) {
    pipeline = pipeline.resize(options.maxSize, options.maxSize, {
      fit: "inside",
      withoutEnlargement: true
    });
  }

  if (options.format === "jpg") {
    pipeline = pipeline.jpeg({
      quality: options.quality,
      mozjpeg: true
    });
  } else {
    pipeline = pipeline.webp({
      quality: options.quality,
      effort: 4
    });
  }

  await pipeline.toFile(tempPath);

  const tempStats = await fs.stat(tempPath);
  const outputSize = tempStats.size;

  await fs.rename(tempPath, outputPath);

  if (!sameFile && options.deleteOriginal) {
    await deleteFileWithRetry(filePath);
  }

  const savedBytes = originalSize - outputSize;
  const savedPercent =
    originalSize === 0 ? 0 : Number(((savedBytes / originalSize) * 100).toFixed(1));

  return {
    sourcePath: filePath,
    outputPath,
    originalSize,
    outputSize,
    savedBytes,
    savedPercent,
    skipped: false
  };
}

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);

  return results;
}

export async function convertImages(
  inputOptions: ConvertImagesOptions = {}
): Promise<ConvertImagesSummary> {
  const options = normalizeOptions(inputOptions);
  const log = logger(options.quiet);

  const folderPath = path.resolve(options.folderPath);

  const folderStats = await fs.stat(folderPath);

  if (!folderStats.isDirectory()) {
    throw new Error(`Path is not a directory: ${folderPath}`);
  }

  sharp.cache(false);
  sharp.concurrency(options.concurrency);

  log("");
  log(`Scanning folder: ${folderPath}`);
  log(`Mode: ${options.untrackedFilesOnly ? "untracked git files only" : "folder images"}`);
  log(`Output format: ${options.format}`);
  log(`Quality: ${options.quality}`);
  log(`Max size: ${options.maxSize ?? "none"}`);
  log(`Concurrency: ${options.concurrency}`);

  if (options.concurrency > 1) {
    log(
      "Warning: higher concurrency can process images faster, but it may use significantly more memory."
    );
  }

  log("");

  const imageFiles: string[] = options.untrackedFilesOnly
    ? getUntrackedImageFiles(folderPath)
    : [];

  if (!options.untrackedFilesOnly) {
    for await (const imageFile of walkImageFiles(folderPath, options.recursive)) {
      imageFiles.push(imageFile);
    }
  }

  const results = await processWithConcurrency(
    imageFiles,
    options.concurrency,
    async (imageFile): Promise<ProcessedImageResult> => {
      const outputPath = getOutputPath(imageFile, options.format);

      try {
        const originalStats = await fs.stat(imageFile);

        if (path.resolve(imageFile) !== path.resolve(outputPath)) {
          const outputAlreadyExists = await pathExists(outputPath);

          if (outputAlreadyExists) {
            log(`Skipped: ${imageFile}`);
            log(`  Output already exists: ${outputPath}`);

            return {
              sourcePath: imageFile,
              outputPath,
              originalSize: originalStats.size,
              outputSize: originalStats.size,
              savedBytes: 0,
              savedPercent: 0,
              skipped: true,
              reason: `Output already exists: ${outputPath}`
            };
          }
        }

        log(`Processing: ${imageFile}`);

        const result = await processImage(imageFile, options);

        log(
          `✓ ${path.basename(result.outputPath)} ${formatBytes(
            result.originalSize
          )} → ${formatBytes(result.outputSize)} (${result.savedPercent}% saved)`
        );

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        log(`✗ Failed: ${imageFile}`);
        log(`  ${message}`);

        return {
          sourcePath: imageFile,
          outputPath,
          originalSize: 0,
          outputSize: 0,
          savedBytes: 0,
          savedPercent: 0,
          skipped: true,
          reason: message
        };
      }
    }
  );

  const completed = results.filter((result) => !result.skipped);
  const skipped = results.filter((result) => result.skipped);

  const totalOriginalSize = completed.reduce((sum, result) => sum + result.originalSize, 0);
  const totalOutputSize = completed.reduce((sum, result) => sum + result.outputSize, 0);
  const totalSavedBytes = totalOriginalSize - totalOutputSize;
  const totalSavedPercent =
    totalOriginalSize === 0
      ? 0
      : Number(((totalSavedBytes / totalOriginalSize) * 100).toFixed(1));

  const summary: ConvertImagesSummary = {
    folderPath,
    format: options.format,
    quality: options.quality,
    maxSize: options.maxSize,
    untrackedFilesOnly: options.untrackedFilesOnly,
    concurrency: options.concurrency,
    processed: completed.length,
    skipped: skipped.length,
    totalOriginalSize,
    totalOutputSize,
    totalSavedBytes,
    totalSavedPercent,
    results
  };

  log("");
  log("Summary:");
  log(`Processed: ${summary.processed}`);
  log(`Skipped: ${summary.skipped}`);
  log(`Before: ${formatBytes(summary.totalOriginalSize)}`);
  log(`After: ${formatBytes(summary.totalOutputSize)}`);
  log(`Saved: ${formatBytes(summary.totalSavedBytes)} (${summary.totalSavedPercent}%)`);

  return summary;
}