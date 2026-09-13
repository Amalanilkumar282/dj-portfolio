import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';

/**
 * Enables Next Draft Mode so an unpublished/scheduled page can be previewed
 * from admin. `token` must match `PREVIEW_TOKEN` — anyone with the token can
 * preview drafts, so it is treated like a secret, not a public query param
 * pattern.
 */
export async function GET(request: NextRequest): Promise<void> {
  const token = request.nextUrl.searchParams.get('token');
  const path = request.nextUrl.searchParams.get('path') ?? '/';

  if (!token || token !== process.env.PREVIEW_TOKEN) {
    redirect('/');
  }

  (await draftMode()).enable();
  redirect(path);
}
