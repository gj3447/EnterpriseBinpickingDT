import { RobotViewer } from "./components/RobotViewer";
import { RobotSidePanel } from "./components/RobotSidePanel";
import { loadYcbObjects } from "@/lib/ycb";

export default async function RobotDTPage() {
  const ycbObjects = await loadYcbObjects();

  return (
    <main className="w-screen h-screen bg-neutral-900 text-neutral-100">
      <div className="flex flex-col lg:flex-row h-full">
        <section className="flex-1 min-h-[50vh] lg:min-h-full border-b lg:border-b-0 lg:border-r border-neutral-800">
          <RobotViewer />
        </section>
        <aside className="w-full lg:w-[440px] xl:w-[480px] h-full">
          <RobotSidePanel objects={ycbObjects} />
        </aside>
      </div>
    </main>
  );
}
