import { NextRequest, NextResponse } from 'next/server';

import { appConfig } from '@/config';

const IKPY_DOWNWARD_ENDPOINT = appConfig.robotIk.ikpyDownwardEndpoint;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(IKPY_DOWNWARD_ENDPOINT, {
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
        message: 'Failed to reach IKPy downward service',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


