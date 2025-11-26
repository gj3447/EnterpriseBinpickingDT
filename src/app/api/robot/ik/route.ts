import { NextRequest, NextResponse } from 'next/server';

import { appConfig } from '@/config';

const ROBOT_IK_ENDPOINT = appConfig.robotIk.ikEndpoint;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await fetch(ROBOT_IK_ENDPOINT, {
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
        message: 'Failed to reach robot IK service',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
