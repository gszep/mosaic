export interface TMJObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: { name: string; type: string; value: string }[];
}

export interface TMJLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];
  objects?: TMJObject[];
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
