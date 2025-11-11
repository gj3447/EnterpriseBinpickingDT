import { promises as fs } from "fs";
import path from "path";

export interface YcbObjectData {
  name: string;
  images: string[];
}

const RGB_PATTERN = /^rgb_\d+\.png$/i;

const parseIndex = (filename: string) => {
  const match = filename.match(/rgb_(\d+)\.png/i);
  return match ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

export async function loadYcbObjects(): Promise<YcbObjectData[]> {
  const baseDir = path.join(process.cwd(), "public", "ycb_images");

  let entries: string[] = [];
  try {
    entries = await fs.readdir(baseDir);
  } catch (error) {
    console.error("ycb_images 경로를 읽을 수 없습니다.", error);
    return [];
  }

  const objects = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(baseDir, entry);
      const stats = await fs.stat(entryPath).catch(() => null);

      if (!stats || !stats.isDirectory()) {
        return null;
      }

      const files = await fs.readdir(entryPath).catch(() => []);

      const rgbImages = files
        .filter((file) => RGB_PATTERN.test(file))
        .sort((a, b) => parseIndex(a) - parseIndex(b))
        .map((file) => path.posix.join("/ycb_images", entry, file));

      return {
        name: entry,
        images: rgbImages,
      } satisfies YcbObjectData;
    })
  );

  return objects
    .filter((value): value is YcbObjectData => value !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

