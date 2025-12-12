// import Image, { type ImageProps } from 'next/image';

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
