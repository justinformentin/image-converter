#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { convertImages, type OutputFormat } from './index.js';

function printHelp() {
  console.log(`
Usage:
  image-converter [quality] [untracked] [options]

Examples:
  image-converter 90
  image-converter -q 90 -p /content/images -f webp
  image-converter --quality 50 untracked
  image-converter --max-size 1200
  image-converter -p ./images -f jpg -q 80 --recursive
  image-converter --quiet

Options:
  -p, --path <path>          Folder path. Default: /
  -q, --quality <number>     Quality from 1 to 100. Default: 85
  -f, --format <format>      Output format: jpg or webp. Default: jpg
  -m, --max-size <number>    Max width/height in pixels. Default: none
  -u, --untracked            Only process untracked git files
      --quiet                Suppress logs
      --recursive            Process nested folders
      --keep-original        Keep original file when changing formats
  -h, --help                 Show help
`);
}

function parseCliArgs(argv: string[]) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      path: {
        type: 'string',
        short: 'p',
      },
      quality: {
        type: 'string',
        short: 'q',
      },
      format: {
        type: 'string',
        short: 'f',
      },
      'max-size': {
        type: 'string',
        short: 'm',
      },
      untracked: {
        type: 'boolean',
        short: 'u',
      },
      concurrency: {
        type: 'string',
        short: 'c',
      },
      quiet: {
        type: 'boolean',
      },
      recursive: {
        type: 'boolean',
      },
      'keep-original': {
        type: 'boolean',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  });

  if (parsed.values.help) {
    printHelp();
    process.exit(0);
  }

  let quality = parsed.values.quality
    ? Number(parsed.values.quality)
    : undefined;
  let untrackedFilesOnly = Boolean(parsed.values.untracked);

  for (const positional of parsed.positionals) {
    if (positional === 'untracked') {
      untrackedFilesOnly = true;
      continue;
    }

    const maybeQuality = Number(positional);

    if (Number.isInteger(maybeQuality)) {
      quality = maybeQuality;
      continue;
    }

    throw new Error(`Unknown positional argument: ${positional}`);
  }

  const format = parsed.values.format;

  if (format !== undefined && format !== 'jpg' && format !== 'webp') {
    throw new Error('Format must be either "jpg" or "webp".');
  }

  const maxSize = parsed.values['max-size']
    ? Number(parsed.values['max-size'])
    : null;

  const concurrency = parsed.values.concurrency
    ? Number(parsed.values.concurrency)
    : 1;

  return {
    folderPath: parsed.values.path ?? '/',
    quality: quality ?? 85,
    format: (format ?? 'jpg') as OutputFormat,
    maxSize,
    untrackedFilesOnly,
    concurrency,
    quiet: Boolean(parsed.values.quiet),
    recursive: Boolean(parsed.values.recursive),
    deleteOriginal: !Boolean(parsed.values['keep-original']),
  };
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  await convertImages(options);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
