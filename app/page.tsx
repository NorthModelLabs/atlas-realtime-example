import Demo, { type UiMode } from "./demo";

const UI_MODES = new Set<UiMode>(["studio", "tiktok", "teacher", "meet"]);

type PageProps = {
  searchParams?: Promise<{ ui?: string }>;
};

function parseUiMode(ui?: string): UiMode {
  return ui && UI_MODES.has(ui as UiMode) ? (ui as UiMode) : "studio";
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  return <Demo initialUiMode={parseUiMode(params?.ui)} />;
}
