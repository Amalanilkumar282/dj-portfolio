import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatIstDate } from '@dj/utils';

import { Container, Section } from '../../../../components/container';
import { RichText } from '../../../../components/rich-text';
import { JsonLd, type JsonLdNode } from '../../../../lib/json-ld';
import { absoluteUrl } from '../../../../lib/site';
import { getPost } from '../../../../server/queries/posts';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const url = absoluteUrl(`/blog/${slug}`);
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: { url, type: 'article', publishedTime: post.publishedAt?.toISOString() },
  };
}

export default async function PostPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const url = absoluteUrl(`/blog/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#post`,
      headline: post.title,
      datePublished: post.publishedAt ? post.publishedAt.toISOString() : undefined,
      author: { '@type': 'Person', name: post.authorName ?? 'DJ Felicitous' },
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-2xl">
        <h1 className="font-display text-h1 text-fg-strong">{post.title}</h1>
        <p className="text-fg-muted mt-4 text-sm">
          {post.authorName ?? 'DJ Felicitous'}
          {post.publishedAt ? ` · ${formatIstDate(post.publishedAt)}` : ''}
          {post.readingMinutes ? ` · ${String(post.readingMinutes)} min read` : ''}
        </p>
        <div className="mt-8">
          <RichText content={post.content} />
        </div>
        {post.tags.length > 0 ? (
          <ul className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag.id} className="text-fg-muted text-xs">
                #{tag.slug}
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
