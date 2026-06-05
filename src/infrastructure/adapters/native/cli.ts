import * as fs from 'fs';
import * as path from 'path';
import { NativeConverterAdapter } from './NativeConverterAdapter';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node cli.js <inputPath> <outputPath>');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  try {
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file does not exist: ${inputPath}`);
      process.exit(1);
    }

    const docxBuffer = fs.readFileSync(inputPath);
    const adapter = new NativeConverterAdapter();
    const pdfBuffer = await adapter.convert(docxBuffer);

    // Ensure target directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`Successfully converted ${inputPath} to ${outputPath}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`Conversion failed: ${error.message}`);
    process.exit(2);
  }
}

main();
