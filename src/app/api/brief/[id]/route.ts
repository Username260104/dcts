import { NextRequest, NextResponse } from 'next/server';
import { getBrief } from '@/lib/briefStore';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const stored = await getBrief(id);

    if (!stored) {
        return NextResponse.json(
            { error: '브리프를 찾을 수 없습니다. 저장되지 않았거나 만료되었습니다.' },
            { status: 404 }
        );
    }

    return NextResponse.json(stored);
}
