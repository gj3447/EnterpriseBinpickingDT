import { YcbObjectViewer } from "./components/YcbObjectViewer";
import { loadYcbObjects } from "@/lib/ycb";

export default async function YcbBrowserPage() {
  const objects = await loadYcbObjects();

  return (
    <main>
      <YcbObjectViewer objects={objects} variant="page" />
    </main>
  );
}

