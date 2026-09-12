import type { Metadata } from 'next';

import { PostForm } from '../../../../components/post-form';

export const metadata: Metadata = { title: 'New post' };

export default function NewPostPage(): React.JSX.Element {
  return <PostForm />;
}
