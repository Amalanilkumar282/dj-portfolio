import { NextResponse } from 'next/server';

import { absoluteUrl, SITE } from '../../../lib/site';
import { getPosts } from '../../../server/queries/posts';

export const revalidate = 3600;

/** JSON Feed 1.1 — https://www.jsonfeed.org/version/1.1/ */
export async function GET(): Promise<NextResponse> {
  const posts = await getPosts({ limit: 50 });

  return NextResponse.json(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: `${SITE.name} — Blog`,
      home_page_url: absoluteUrl('/blog'),
      feed_url: absoluteUrl('/api/feed.json'),
      description: SITE.defaultDescription,
      language: 'en-IN',
      items: posts.map((post) => ({
        id: absoluteUrl(`/blog/${post.slug}`),
        url: absoluteUrl(`/blog/${post.slug}`),
        title: post.title,
        summary: post.excerpt ?? undefined,
        date_published: post.publishedAt?.toISOString(),
        author: { name: post.authorName ?? 'DJ Felicitous' },
        tags: post.tags.map((tag) => tag.name),
      })),
    },
    { headers: { 'content-type': 'application/feed+json; charset=utf-8' } },
  );
}
