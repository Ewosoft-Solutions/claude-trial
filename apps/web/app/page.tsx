// import Image, { type ImageProps } from 'next/image';

import { ChartAreaInteractive } from '@workspace/ui/custom/charts/chart-area-interactive';
import { SectionCards } from '@workspace/ui/custom/sections/section-cards';
import { DataTable } from '@workspace/ui/custom/tables/data-table';

import data from './data.json';

// type Props = Omit<ImageProps, 'src'> & {
//   srcLight: string;
//   srcDark: string;
// };

// const ThemeImage = (props: Props) => {
//   const { srcLight, srcDark, ...rest } = props;

//   return (
//     <>
//       <Image {...rest} src={srcLight} className="imgLight" />
//       <Image {...rest} src={srcDark} className="imgDark" />
//     </>
//   );
// };

export default async function Home() {
  return (
    <div>
      <main>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </main>

      <footer>
        <p> Ewosoft Solutions © {new Date().getFullYear()}.</p>
        <p>All rights reserved.</p>
      </footer>
    </div>
  );
}
