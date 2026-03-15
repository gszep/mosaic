export type { TMJLayer, TMJTileset, TMJMap } from "../src/shared/tmj";
import type { TMJTileset, TMJMap } from "../src/shared/tmj";

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