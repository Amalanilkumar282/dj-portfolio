import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../../../components/container';
import { absoluteUrl } from '../../../../../lib/site';
import { getPosts } from '../../../../../server/queries/posts';

interface Params {
  tag: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag}`,
    alternates: { canonical: absoluteUrl(`/blog/tag/${tag}`) },
  };
}

export default async function BlogTagPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { tag } = await params;
  const posts = await getPosts({ tagSlug: tag });

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Tagged" title={`#${tag}`} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="rounded-md border border-border bg-surface p-5 hover:border-accent"
            >
              <p className="text-fg-strong font-semibold">{post.title}</p>
              {post.excerpt ? <p className="text-fg-muted mt-2 text-sm">{post.excerpt}</p> : null}
            </Link>
          ))}
        </div>
        {posts.length === 0 ? <p className="text-fg-muted">No posts tagged &quot;{tag}&quot; yet.</p> : null}
      </Container>
    </Section>
  );
}
