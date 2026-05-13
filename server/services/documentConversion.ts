import { promises as fs } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import XLSX from 'xlsx';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

const textExtensions = new Set(['.txt', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.log']);

export async function convertUploadToMarkdown(filePath: string, originalName: string, mimeType: string) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.md' || ext === '.markdown') {
    return fs.readFile(filePath, 'utf8');
  }

  if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ path: filePath });
    return turndown.turndown(result.value);
  }

  if (['.xlsx', '.xls', '.ods'].includes(ext)) {
    const workbook = XLSX.readFile(filePath);
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const markdownTable = XLSX.utils.sheet_to_html(sheet);
      return `## ${sheetName}\n\n${turndown.turndown(markdownTable)}`;
    }).join('\n\n');
  }

  if (mimeType.includes('html') || ext === '.html' || ext === '.htm') {
    const html = await fs.readFile(filePath, 'utf8');
    return turndown.turndown(html);
  }

  if (mimeType.startsWith('text/') || textExtensions.has(ext)) {
    const text = await fs.readFile(filePath, 'utf8');
    return ext === '.txt' ? text : `\`\`\`${ext.replace('.', '') || 'text'}\n${text}\n\`\`\``;
  }

  return null;
}

export function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}
