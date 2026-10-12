import Demo from "../demo";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = { title: "Anime demo · Atlas" };
export default function AnimePage() {
  if (process.env.ATLAS_ANIME_DEMO_ENABLED !== "true") {
    return <main style={{ padding: 48 }}><h1>Anime demo</h1><p>This prototype is not enabled. No portrait preparation or sessions run here.</p><Link href="/">Human demo</Link></main>;
  }
  return <Demo animeDemo />;
}
