# image-converter

Convert and compress images from Node.js or the command line.

`image-converter` is a lightweight image conversion utility built on [Sharp](https://sharp.pixelplumbing.com/) as the single dependency, and the total size is 10.8 KB, 5.6Kb minified.

## Features

- **Convert** — accepts `jpg`, `png`, `webp`, `gif`, `avif`, `tiff`, `svg`, and `heif` input; outputs `jpg` or `webp`
- **Compress** — configurable quality from `1` to `100`
- **Resize** — shrink images so neither dimension exceeds a maximum pixel value
- **Recursive** — optionally scan nested folders
- **Parallel processing** — configurable concurrency for faster batch processing
- **Skip already-processed images** — optionally process only untracked git files, so re-running never re-converts images already committed to the repo
- **Original file control** — delete or keep the source file after conversion
- **CLI and JS/TS API** — run with `npx` or import into any Node.js project

---

## Why

I built this to make preparing images for publishing easier. Many platforms optimize images automatically, but on my personal website hosted on my VPS, images still need to be stored somewhere.

I don't want to take up multiple megabytes of storage with images that will only ever be displayed at a much smaller size on screen. With this tool, you can add images to your repo, run the CLI, and automatically convert and resize any images that haven't already been processed.

Check out [x-rsync](https://www.npmjs.com/package/x-rsync) for a cross-platform way to easily sync your repo to your VPS and avoid re-uploading unchanged files.

---

## Installation

```bash
npm install image-converter
```

Or run directly with `npx`:

```bash
npx image-converter
```

---

## CLI usage

```bash
image-converter [options]
```

### Examples

Convert images using default settings (folder `/`, format `jpg`, quality `85`):

```bash
npx image-converter
```

Convert images in a specific folder to `webp`:

```bash
npx image-converter -p ./images -f webp -q 90
```

Resize images so the largest dimension is at most `1200px`:

```bash
npx image-converter -p ./images --max-size 1200
```

Convert recursively:

```bash
npx image-converter -p ./images -f webp --recursive
```

Process only untracked git files (skip already-committed images):

```bash
npx image-converter -p ./project --untracked
```

Process images faster with concurrency:

```bash
npx image-converter -p ./images -f webp -q 85 --concurrency 4
```

Suppress logs:

```bash
npx image-converter -p ./images -f webp --quiet
```

---

## CLI options

| Option | Alias | Description | Default |
|---|---:|---|---:|
| `--path <path>` | `-p` | Folder to scan | `/` |
| `--quality <number>` | `-q` | Output quality from `1` to `100` | `85` |
| `--format <format>` | `-f` | Output format: `jpg` or `webp` | `jpg` |
| `--max-size <number>` | `-m` | Maximum width/height in pixels | `null` |
| `--untracked` | `-u` | Only process untracked git files | `false` |
| `--recursive` | | Process nested folders | `false` |
| `--keep-original` | | Keep the original file when converting formats | `false` |
| `--concurrency <number>` | `-c` | Number of images to process in parallel | `1` |
| `--quiet` | | Suppress logs | `false` |
| `--help` | `-h` | Show help output | |

---

## Default behavior

By default, `image-converter` uses conservative settings:

```ts
{
  folderPath: "/",
  quality: 85,
  format: "jpg",
  maxSize: null,
  untrackedFilesOnly: false,
  deleteOriginal: true,
  recursive: false,
  concurrency: 1,
  quiet: false
}
```

So this:

```bash
npx image-converter
```

is equivalent to:

```bash
npx image-converter --path / --quality 85 --format jpg --concurrency 1
```

---

## Output formats

### JPG

Useful for photos, screenshots, and general compressed image output.

```bash
npx image-converter -p ./images -f jpg
```

### WebP

Useful for web projects where smaller file sizes matter.

```bash
npx image-converter -p ./images -f webp
```

---

## Resizing

Use `--max-size` to resize images so the largest dimension does not exceed the given value. Aspect ratio is preserved and images are never enlarged.

```bash
npx image-converter -p ./images --max-size 1200
```

| Original size | `--max-size 1200` result |
|---|---|
| `3000x2000` | `1200x800` |
| `800x3000` | `320x1200` |
| `900x600` | unchanged |

---

## Skip already-processed images

Use `--untracked` to process only files not yet tracked by git. Re-running the command will never re-convert images already committed to the repo.

```bash
npx image-converter -p ./project --untracked
```

Internally this uses:

```bash
git ls-files --others --exclude-standard
```

The provided path must be inside a git repository.

---

## Original file behavior

By default, when the output format differs from the source format, the original file is deleted after the converted file is successfully written.

```
hero.png  →  hero.webp  (hero.png removed)
```

To keep originals:

```bash
npx image-converter -p ./images -f webp --keep-original
```

Or in Node:

```ts
await convertImages({ folderPath: "./images", format: "webp", deleteOriginal: false });
```

---

## Parallel processing

By default, `image-converter` processes one image at a time, which is safest for memory usage. Increase concurrency to process multiple images simultaneously:

```bash
npx image-converter -p ./images --concurrency 4
```

For large images, keep concurrency low. For smaller web images, `4` works well on most development machines.

---

## Quiet mode

Use `--quiet` to suppress normal logs. Useful for scripts, automation, and CI.

```bash
npx image-converter -p ./images -f webp --quiet
```

Errors are still thrown by the Node API and printed by the CLI.

---

## Using as a Node.js library

```ts
import { convertImages } from "image-converter";

const summary = await convertImages({
  folderPath: "./images",
  quality: 85,
  format: "webp",
  maxSize: 1200,
  recursive: true
});

console.log(`Processed ${summary.processed} images`);
console.log(`Saved ${summary.totalSavedPercent}%`);
```

---

## API

### `convertImages(options?)`

#### Options

```ts
export type OutputFormat = "jpg" | "webp";

export interface ConvertImagesOptions {
  // Folder to scan. Default: "/"
  folderPath?: string;

  // Image quality from 1 to 100. Default: 85
  quality?: number;

  // Only process untracked git files. Default: false
  untrackedFilesOnly?: boolean;

  // Maximum image dimension in pixels. null means no resizing. Default: null
  maxSize?: number | null;

  // Output format. Default: "jpg"
  format?: OutputFormat;

  // Delete the original file when the output format changes. Default: true
  deleteOriginal?: boolean;

  // Process nested folders. Default: false
  recursive?: boolean;

  // Number of images to process in parallel. Default: 1
  concurrency?: number;

  // Suppress logs. Default: false
  quiet?: boolean;
}
```

#### Return value

```ts
interface ConvertImagesSummary {
  folderPath: string;
  format: "jpg" | "webp";
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

interface ProcessedImageResult {
  sourcePath: string;
  outputPath: string;
  originalSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
  skipped: boolean;
  reason?: string;
}
```

---

## Local development

```bash
npm install
npm run build
node dist/cli.js --help
```

### Test options

**With `node`:**

```bash
npm run build && node dist/cli.js -p ./test-images -q 80 -f webp
```

**With `npm link`:**

```bash
npm run build && npm link
image-converter -p ./test-images -f webp -q 85
npm unlink -g image-converter
```

**With `npx .`:**

```bash
npm run build && npx . -p ./test-images -f webp -q 85
```

**With the packed tarball (closest to published install):**

```bash
npm run build && npm pack
npx ./image-converter-0.1.0.tgz -p ./test-images -f webp -q 85
```

---

## Requirements

- Node.js `18` or newer
- Sharp-compatible operating system

---

## License

MIT
