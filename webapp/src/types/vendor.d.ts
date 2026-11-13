declare module "plotly.js-dist-min" {
  const Plotly: {
    newPlot: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>;
    react: (el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown) => Promise<unknown>;
    purge: (el: HTMLElement) => void;
    Plots: { resize: (el: HTMLElement) => void };
  };
  export default Plotly;
}

declare module "xlsx" {
  export const utils: any;
  export function writeFile(wb: any, filename: string): void;
  const XLSX: any;
  export default XLSX;
}
