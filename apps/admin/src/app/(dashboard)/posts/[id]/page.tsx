import type { Metadata } from 'next';

import { PostForm } from '../../../../components/post-form';

export const metadata: Metadata = { title: 'Edit post' };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PostForm id={id} />;
}
