import Demo, { type UiMode, type VoiceMode } from "./demo";

const UI_MODES = new Set<UiMode>(["studio", "tiktok", "teacher", "meet"]);

type PageProps = {
  searchParams?: Promise<{ ui?: string; voice?: string }>;
};

function parseUiMode(ui?: string): UiMode {
  return ui && UI_MODES.has(ui as UiMode) ? (ui as UiMode) : "studio";
}

function parseVoiceMode(voice?: string): VoiceMode {
  return voice === "mirror" ? "mirror" : "ai";
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  return <Demo initialUiMode={parseUiMode(params?.ui)} initialVoiceMode={parseVoiceMode(params?.voice)} />;
}
