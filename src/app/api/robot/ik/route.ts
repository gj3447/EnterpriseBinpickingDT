import { NextRequest, NextResponse } from 'next/server';

const ROBOT_IK_ENDPOINT = process.env.ROBOT_IK_ENDPOINT ?? 'http://192.168.0.196:53000/api/robot/ik';

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
