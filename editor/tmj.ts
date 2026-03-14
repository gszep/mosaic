export interface TMJLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];
  width: number;
  height: number;
  visible: boolean;
  x: number;
  y: number;
  id: number;
  opacity: number;
}

export interface TMJTileset {
  firstgid: number;
  image: string;
  tilewidth: number;
  tileheight: number;
  imagewidth: number;
  imageheight: number;
  columns: number;
  name: string;
  tilecount: number;
}

export interface TMJMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TMJLayer[];
  tilesets: TMJTileset[];
  orientation: string;
  renderorder: string;
  tiledversion: string;
  type: string;
  version: string;
}

export function createEmptyMap(
  width: number,
  height: number,
  tileSize: number,
  tilesets: TMJTileset[],
  layerNames: string[]
): TMJMap {
  return {
    width,
    height,
    tilewidth: tileSize,
    tileheight: tileSize,
    orientation: "orthogonal",
    renderorder: "right-down",
    tiledversion: "1.11.0",
    type: "map",
    version: "1.10",
    tilesets,
    layers: layerNames.map((name, i) => ({
      id: i + 1,
      name,
      type: "tilelayer" as const,
      data: new Array(width * height).fill(0),
      width,
      height,
      visible: true,
      x: 0,
      y: 0,
      opacity: 1,
    })),
  };
}

export function downloadTMJ(map: TMJMap, filename: string) {
  const json = JSON.stringify(map, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
