export type RouteConfig = {
  label: string;
  href?: string;
  generateLabel?: (params: Record<string, string>) => string;
  children?: Record<string, RouteConfig>;
};
