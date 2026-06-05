import * as mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { IConverterService } from '../../../domain/interfaces/IConverterService';
import { ConversionFailedError } from '../../../domain/errors/ConversionError';
import { Logger } from '../../logging/Logger';

export class NativeConverterAdapter implements IConverterService {
  public async convert(fileBuffer: Buffer): Promise<Buffer> {
    try {
      Logger.info('Starting Native JS DOCX to PDF conversion...');
      
      // Convert docx to HTML using mammoth to preserve basic elements (paragraphs, headings)
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      const html = result.value;
      
      return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(new ConversionFailedError('PDF generation failed', err.message)));

        // Clean HTML entities helper
        const decodeEntities = (text: string) => {
          return text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        };

        // Basic HTML tag parser (headings, paragraphs, lists)
        const tagRegex = /<(p|h1|h2|h3|h4|h5|h6|ul|ol|li)>([\s\S]*?)<\/\1>/gi;
        let match;
        let elementsFound = false;

        while ((match = tagRegex.exec(html)) !== null) {
          elementsFound = true;
          const tag = match[1].toLowerCase();
          const rawContent = match[2];
          
          // Strip internal inline tags like <strong>, <em> etc.
          let content = rawContent.replace(/<[^>]+>/g, '').trim();
          content = decodeEntities(content);

          if (!content) continue;

          if (tag.startsWith('h')) {
            const fontSize = tag === 'h1' ? 22 : tag === 'h2' ? 17 : 13;
            doc.font('Helvetica-Bold').fontSize(fontSize).text(content);
            doc.moveDown(0.5);
          } else if (tag === 'li') {
            doc.font('Helvetica').fontSize(10).text(`•  ${content}`, { indent: 15 });
            doc.moveDown(0.25);
          } else {
            // standard paragraph
            doc.font('Helvetica').fontSize(10.5).text(content, {
              align: 'justify',
              lineGap: 2
            });
            doc.moveDown(0.8);
          }
        }

        // Fallback: If html parser didn't yield matches, use raw text split by linebreaks
        if (!elementsFound) {
          Logger.warn('No structured tags found in HTML, falling back to raw text parsing.');
          const text = html.replace(/<[^>]+>/g, '\n');
          const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
            
          for (const line of lines) {
            doc.font('Helvetica').fontSize(10.5).text(decodeEntities(line));
            doc.moveDown(0.8);
          }
        }
        
        doc.end();
      });
    } catch (error: any) {
      Logger.error('Native JS conversion failed', error);
      throw new ConversionFailedError('Native JS conversion failed', error.message);
    }
  }
}
