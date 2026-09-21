import Demo, { type UiMode } from "./demo";

const UI_MODES = new Set<UiMode>(["apple", "tiktok", "teacher", "meet"]);

type PageProps = {
  searchParams?: Promise<{ ui?: string; voice?: string }>;
};

function parseUiMode(ui?: string): UiMode {
  return ui && UI_MODES.has(ui as UiMode) ? (ui as UiMode) : "apple";
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  return <Demo initialUiMode={parseUiMode(params?.ui)} initialVoiceMode="ai" />;
}
