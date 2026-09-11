import type { Metadata } from 'next';
import Link from 'next/link';

import { formatIstDate } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getPosts, getTags } from '../../../server/queries/posts';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on production, gear, gigs and the road.',
  alternates: { canonical: absoluteUrl('/blog') },
};

export default async function BlogPage(): Promise<React.JSX.Element> {
  const [posts, tags] = await Promise.all([getPosts(), getTags()]);

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Notes" title="Blog" />
        {tags.length > 0 ? (
          <ul className="mb-8 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.id}>
                <Link
                  href={`/blog/tag/${tag.slug}`}
                  className="rounded-full border border-border px-3 py-1 text-xs text-fg-secondary hover:border-accent"
                >
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="rounded-md border border-border bg-surface p-5 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{post.title}</p>
              {post.excerpt ? <p className="text-fg-muted mt-2 text-sm">{post.excerpt}</p> : null}
              <p className="text-fg-muted mt-4 text-xs">
                {post.publishedAt ? formatIstDate(post.publishedAt) : ''}
                {post.readingMinutes ? ` · ${String(post.readingMinutes)} min read` : ''}
              </p>
            </Link>
          ))}
        </div>
        {posts.length === 0 ? <p className="text-fg-muted">No posts published yet.</p> : null}
      </Container>
    </Section>
  );
}
