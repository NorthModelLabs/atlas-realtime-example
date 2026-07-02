import Demo, { type UiMode, type VoiceMode } from "./demo";

const UI_MODES = new Set<UiMode>(["studio", "tiktok", "teacher", "meet", "mirror"]);

type PageProps = {
  searchParams?: Promise<{ ui?: string; voice?: string }>;
};

function parseUiMode(ui?: string, voice?: string): UiMode {
  if (!ui && voice === "mirror") return "mirror";
  return ui && UI_MODES.has(ui as UiMode) ? (ui as UiMode) : "studio";
}

function parseVoiceMode(voice?: string, ui?: string): VoiceMode {
  if (ui === "mirror") return "mirror";
  return voice === "mirror" ? "mirror" : "ai";
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  return <Demo initialUiMode={parseUiMode(params?.ui, params?.voice)} initialVoiceMode={parseVoiceMode(params?.voice, params?.ui)} />;
}
