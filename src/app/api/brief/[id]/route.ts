import { NextRequest, NextResponse } from 'next/server';
import { getBrief } from '@/lib/briefStore';

// GET /api/brief/:id — 저장된 브리프 조회 (퍼머링크용)
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const stored = getBrief(id);

    if (!stored) {
        return NextResponse.json(
            { error: '브리프를 찾을 수 없습니다. 세션이 만료되었을 수 있습니다.' },
            { status: 404 }
        );
    }

    return NextResponse.json(stored);
}
