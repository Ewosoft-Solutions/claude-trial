/**
 * jsdom mock for recharts' ResponsiveContainer.
 *
 * The real container measures its parent with a `ResizeObserver` (absent in
 * jsdom) and renders nothing while the measured size is 0×0 — so charts never
 * mount under test. This replacement clones the chart child with a fixed pixel
 * size, mirroring what ResponsiveContainer does once it has measured, so the
 * SVG renders synchronously.
 *
 * Usage (top of a chart test file, before other imports run):
 *
 *   vi.mock('recharts', async (importActual) => {
 *     const actual = await importActual<typeof import('recharts')>();
 *     const { withFixedResponsiveContainer } = await import(
 *       '../../test/recharts-mock'
 *     );
 *     return withFixedResponsiveContainer(actual);
 *   });
 */
import * as React from 'react';

const WIDTH = 800;
const HEIGHT = 400;

function FixedResponsiveContainer({
  children,
}: {
  children: React.ReactElement<{ width?: number; height?: number }>;
}) {
  return (
    <div style={{ width: WIDTH, height: HEIGHT }}>
      {React.cloneElement(children, { width: WIDTH, height: HEIGHT })}
    </div>
  );
}

/** Return the recharts module with ResponsiveContainer swapped for the stub. */
export function withFixedResponsiveContainer<T extends object>(actual: T): T {
  return { ...actual, ResponsiveContainer: FixedResponsiveContainer };
}
