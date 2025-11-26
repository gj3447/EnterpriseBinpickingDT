import { NextRequest, NextResponse } from 'next/server';

import { appConfig } from '@/config';

const DOWNWARD_ENDPOINT = appConfig.robotIk.ikDownwardEndpoint;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(DOWNWARD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Failed to reach robot IK downward service',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
