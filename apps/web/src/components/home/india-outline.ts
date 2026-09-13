/**
 * A stylised India silhouette and the projection that places pins on it.
 *
 * The outline is stored as real latitude/longitude and run through the *same*
 * `project()` the venue pins use, so a pin can never drift relative to the
 * coastline — the two cannot disagree, because they share one transform. It
 * is a simplified boundary (~40 vertices) chosen for silhouette, not for
 * cartographic accuracy, and carries no disputed-border claim; it is a
 * decorative figure, `aria-hidden`, with the venue list as its real interface.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** The equirectangular window: the whole country, with a little margin. */
const WEST = 68;
const EAST = 98;
const NORTH = 37;
const SOUTH = 8;

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 116;

/** Equirectangular. At this scale and latitude the distortion is invisible. */
export function project({ lat, lng }: LatLng): { x: number; y: number } {
  return {
    x: ((lng - WEST) / (EAST - WEST)) * VIEW_WIDTH,
    y: ((NORTH - lat) / (NORTH - SOUTH)) * VIEW_HEIGHT,
  };
}

const OUTLINE: LatLng[] = [
  { lat: 36.5, lng: 74.5 },
  { lat: 35.5, lng: 77.8 },
  { lat: 34.0, lng: 78.9 },
  { lat: 32.5, lng: 79.2 },
  { lat: 31.0, lng: 81.0 },
  { lat: 30.0, lng: 81.0 },
  { lat: 29.5, lng: 82.5 },
  { lat: 28.5, lng: 84.0 },
  { lat: 27.5, lng: 88.0 },
  { lat: 27.9, lng: 88.9 },
  { lat: 27.2, lng: 92.0 },
  { lat: 28.2, lng: 95.3 },
  { lat: 27.0, lng: 97.0 },
  { lat: 25.5, lng: 95.2 },
  { lat: 24.0, lng: 94.5 },
  { lat: 23.0, lng: 93.3 },
  { lat: 22.0, lng: 92.5 },
  { lat: 23.7, lng: 90.3 },
  { lat: 21.6, lng: 89.0 },
  { lat: 20.3, lng: 86.9 },
  { lat: 17.0, lng: 82.3 },
  { lat: 15.9, lng: 80.3 },
  { lat: 13.1, lng: 80.3 },
  { lat: 10.3, lng: 79.9 },
  { lat: 8.1, lng: 77.5 },
  { lat: 9.0, lng: 76.5 },
  { lat: 12.0, lng: 74.8 },
  { lat: 15.0, lng: 73.8 },
  { lat: 18.9, lng: 72.8 },
  { lat: 20.9, lng: 70.0 },
  { lat: 22.5, lng: 69.0 },
  { lat: 23.7, lng: 68.2 },
  { lat: 24.7, lng: 71.0 },
  { lat: 26.0, lng: 70.1 },
  { lat: 27.9, lng: 70.5 },
  { lat: 29.5, lng: 73.0 },
  { lat: 32.0, lng: 74.5 },
  { lat: 34.0, lng: 73.9 },
];

export const INDIA_OUTLINE_PATH = `${OUTLINE.map((coordinate, index) => {
  const { x, y } = project(coordinate);
  return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
}).join(' ')} Z`;
