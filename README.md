# image-converter

Convert and compress images from Node.js or the command line.

`image-converter` is a small image conversion utility built on top of Sharp. It can convert images to `jpg` or `webp`, resize large images, compress output files, process only untracked git files, and run either as a Node.js library or a CLI through `npx`.

## Why
I built this to make preparing images for publishing easier. Many platforms already optimize images automatically, but on my personal website, which is hosted on my VPS, the images still need to be stored somewhere.

I don’t want to take up multiple megabytes of storage with images that will only ever be displayed at a much smaller size on the site. With this library, you can add images to your repo, run the CLI script, and automatically resize any images that haven’t already been processed.

---

## Features

- Convert images to `jpg`
- Convert images to `webp`
- Compress images with configurable quality
- Resize images to a maximum width/height
- Process a folder of images
- Optionally process nested folders
- Optionally process only untracked git files
- Optional quiet mode for scripts and CI
- Memory-safe by default
- Optional concurrency for faster processing
- Usable from Node.js
- Usable from the command line with `npx`

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
image-converter [quality] [untracked] [options]
```

### Examples

Convert images using the default folder path `/`, default format `jpg`, and quality `90`:

```bash
npx image-converter 90
```

Convert images in a specific folder to `webp`:

```bash
npx image-converter -q 90 -p /content/images -f webp
```

Convert only untracked git images with quality `50`:

```bash
npx image-converter --quality 50 untracked
```

Equivalent named-flag version:

```bash
npx image-converter --quality 50 --untracked
```

Resize images so the largest dimension is at most `1200px`:

```bash
npx image-converter -p ./images --max-size 1200
```

Convert images recursively:

```bash
npx image-converter -p ./images -f webp --recursive
```

Suppress logs:

```bash
npx image-converter -p ./images -f webp --quiet
```

Process images faster with concurrency:

```bash
npx image-converter -p ./images -f webp -q 85 --concurrency 4
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
| `--quiet` | | Suppress logs | `false` |
| `--recursive` | | Process nested folders | `false` |
| `--keep-original` | | Keep the original file when converting formats | `false` |
| `--concurrency <number>` | `-c` | Number of images to process in parallel | `1` |
| `--help` | `-h` | Show help output | |

---

## Default behavior

By default, `image-converter` uses conservative settings:

```ts
{
  folderPath: "/",
  quality: 85,
  untrackedFilesOnly: false,
  maxSize: null,
  format: "jpg",
  quiet: false,
  deleteOriginal: true,
  recursive: false,
  concurrency: 1
}
```

That means this command:

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

```bash
npx image-converter -p ./images -f jpg
```

Useful for photos, screenshots, and general compressed image output.

### WebP

```bash
npx image-converter -p ./images -f webp
```

Useful for web projects where smaller file sizes are desirable.

---

## Resizing

Use `--max-size` to resize images so the largest dimension does not exceed the provided value.

```bash
npx image-converter -p ./images --max-size 1200
```

This keeps the original aspect ratio.

For example:

| Original size | `--max-size 1200` result |
|---|---|
| `3000x2000` | `1200x800` |
| `800x3000` | `320x1200` |
| `900x600` | unchanged |

Images are not enlarged.

---

## Processing only untracked git files

You can process only files that are currently untracked by git:

```bash
npx image-converter -p ./project --untracked
```

or:

```bash
npx image-converter -p ./project untracked
```

This is useful when you add a batch of new images to a project and want to convert only those new files.

Internally, this uses:

```bash
git ls-files --others --exclude-standard
```

The provided path must be inside a git repository.

---

## Quiet mode

Use `--quiet` to suppress normal logs:

```bash
npx image-converter -p ./images -f webp --quiet
```

This is useful for scripts, automation, and CI workflows.

Errors are still thrown by the Node API and printed by the CLI.

---

## Concurrency and performance

By default, `image-converter` processes one image at a time:

```bash
npx image-converter -p ./images --concurrency 1
```

This is the safest mode for memory usage.

For faster processing, increase concurrency:

```bash
npx image-converter -p ./images --concurrency 4
```

Higher concurrency can be significantly faster, especially for many small or medium-sized images, but it also uses more memory because multiple Sharp pipelines can be active at the same time.

A reasonable starting point is:

```bash
npx image-converter -p ./images --concurrency 2
```

For large images, keep concurrency low. For smaller web images, `4` may be fine on most development machines.

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

console.log(summary);
```

---

## API

### `convertImages(options?)`

```ts
import { convertImages } from "image-converter";

await convertImages({
  folderPath: "./images",
  quality: 90,
  format: "webp"
});
```

### Options

```ts
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
```

---

## Return value

`convertImages()` returns a summary object:

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
```

Each processed image result looks like this:

```ts
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

Example:

```ts
const summary = await convertImages({
  folderPath: "./images",
  format: "webp",
  quiet: true
});

console.log(`Processed ${summary.processed} images`);
console.log(`Saved ${summary.totalSavedPercent}%`);
```

---

## Original file behavior

By default, when the output format is different from the source format, the original file is deleted after the converted file is successfully written.

For example:

```bash
npx image-converter -p ./images -f webp
```

May convert:

```txt
hero.png
```

into:

```txt
hero.webp
```

and then remove:

```txt
hero.png
```

To keep originals, use:

```bash
npx image-converter -p ./images -f webp --keep-original
```

Or in Node:

```ts
await convertImages({
  folderPath: "./images",
  format: "webp",
  deleteOriginal: false
});
```

---

## Local development

Install dependencies:

```bash
npm install
```

Build the package:

```bash
npm run build
```

Run the compiled CLI directly:

```bash
node dist/cli.js --help
```

Test against a local folder:

```bash
node dist/cli.js -p ./test-images -f webp -q 85
```

---

## Testing the CLI locally

### Test with `node`

```bash
npm run build
node dist/cli.js --help
node dist/cli.js -p ./test-images -q 80 -f webp
```

### Test with `npm link`

```bash
npm run build
npm link
```

Then from anywhere:

```bash
image-converter --help
image-converter -p ./test-images -f webp -q 85
```

To unlink:

```bash
npm unlink -g image-converter
```

### Test with `npx .`

From the package root:

```bash
npm run build
npx . --help
npx . -p ./test-images -f webp -q 85
```

### Test the packed package

This is the closest test to how users will install it:

```bash
npm run build
npm pack
```

Then run the generated tarball:

```bash
npx ./image-converter-0.1.0.tgz --help
npx ./image-converter-0.1.0.tgz -p ./test-images -f webp -q 85
```

---

## Requirements

- Node.js `18` or newer
- Sharp-compatible operating system

---

## License

MIT