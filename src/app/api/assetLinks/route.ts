import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PEANUT_API_URL } from '../api.consts

export async function GET(request: NextRequest) {
    const response = await fetch(`${PEANUT_API_URL}/assetLinks.json`)
    const data = await response.json()
    return NextResponse.json(data, {
        status: 200,
    })
}
