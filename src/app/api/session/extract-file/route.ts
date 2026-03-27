import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import path from 'node:path';
import type { ExtractFileResponse } from '@/types/ontology';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 12000;

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.json', '.csv']);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, '.pdf', '.docx']);

function normalizeExtractedText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });

    try {
        const result = await parser.getText();
        return result.text;
    } finally {
        await parser.destroy();
    }
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

async function extractFileText(buffer: Buffer, extension: string): Promise<string> {
    if (TEXT_EXTENSIONS.has(extension)) {
        return buffer.toString('utf8');
    }

    if (extension === '.pdf') {
        return extractTextFromPdf(buffer);
    }

    if (extension === '.docx') {
        return extractTextFromDocx(buffer);
    }

    throw new Error('지원하지 않는 파일 형식입니다.');
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const uploadedFile = formData.get('file');

        if (!(uploadedFile instanceof File)) {
            return NextResponse.json(
                { error: '파일을 찾을 수 없습니다.' },
                { status: 400 }
            );
        }

        if (uploadedFile.size === 0) {
            return NextResponse.json(
                { error: '비어 있는 파일은 업로드할 수 없습니다.' },
                { status: 400 }
            );
        }

        if (uploadedFile.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: '파일 크기는 10MB 이하만 지원합니다.' },
                { status: 400 }
            );
        }

        const extension = path.extname(uploadedFile.name).toLowerCase();

        if (!SUPPORTED_EXTENSIONS.has(extension)) {
            return NextResponse.json(
                { error: 'PDF, DOCX, TXT, MD, JSON, CSV 파일만 지원합니다.' },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await uploadedFile.arrayBuffer());
        const extractedText = normalizeExtractedText(await extractFileText(buffer, extension));

        if (!extractedText) {
            return NextResponse.json(
                { error: '파일에서 읽을 수 있는 텍스트를 찾지 못했습니다.' },
                { status: 400 }
            );
        }

        const originalCharacterCount = extractedText.length;
        const truncated = originalCharacterCount > MAX_EXTRACTED_TEXT_LENGTH;
        const text = truncated
            ? `${extractedText.slice(0, MAX_EXTRACTED_TEXT_LENGTH).trim()}\n\n[문서가 길어 앞부분만 불러왔습니다. 핵심 문단 위주로 정리해 주세요.]`
            : extractedText;

        const response: ExtractFileResponse = {
            text,
            fileName: uploadedFile.name,
            fileType: extension.replace('.', '').toUpperCase(),
            characterCount: text.length,
            originalCharacterCount,
            truncated,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] session/extract-file error:', error);
        return NextResponse.json(
            { error: '파일을 읽는 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
