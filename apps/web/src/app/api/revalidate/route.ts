import { createHmac, timingSafeEqual } from 'node:crypto';

import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

interface RevalidatePayload {
  tags?: string[];
  paths?: string[];
}

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function problem(status: number, detail: string): NextResponse {
  return NextResponse.json(
    { type: `https://api.djfelicitous.com/problems/${detail}`, title: detail, status },
    { status },
  );
}

/**
 * The API's `RevalidationService` posts here after every content mutation.
 * See docs/02-architecture/caching-and-revalidation.md — this is the single
 * most important integration in the system: if it silently breaks, "I
 * published but nothing changed" is the failure mode, and it fails with no
 * exception anywhere obvious.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const raw = await request.text();
  const timestamp = request.headers.get('x-djf-timestamp') ?? '';
  const signature = request.headers.get('x-djf-signature') ?? '';

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return problem(500, 'revalidate-secret-not-configured');

  // The timestamp window is what kills replay of a captured request; a bare
  // bearer secret alone would not.
  if (!timestamp || Math.abs(Date.now() - Number(timestamp)) > REPLAY_WINDOW_MS) {
    return problem(401, 'stale-signature');
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  const validSignature =
    signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!validSignature) return problem(401, 'bad-signature');

  let payload: RevalidatePayload;
  try {
    payload = JSON.parse(raw) as RevalidatePayload;
  } catch {
    return problem(400, 'invalid-json');
  }

  const tags = payload.tags ?? [];
  const paths = payload.paths ?? [];

  tags.forEach(revalidateTag);
  paths.forEach((path) => { revalidatePath(path); });

  return NextResponse.json({ revalidated: { tags, paths }, at: Date.now() });
}
