import src from "../assets/human-svg.svg";

/** A rectangle in the 400 x 800 SVG user-unit space. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The tight bounds of the visible figure inside the image, in natural units. */
export interface FigureBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface FittedImage extends Rect {
  /** Natural-unit to user-unit scale on each axis. */
  scaleX: number;
  scaleY: number;
}

/**
 * X-ray style body image used as a registration overlay.
 *
 * The figure bbox is the measured path bounds inside the SVG viewBox, kept in
 * one place so the calibration can be tuned without touching component code.
 * The SVG canvas has large horizontal padding, so fitting the whole canvas
 * would make the silhouette far too small.
 */
export const BODY_IMAGE = {
  src,
  width: 206.326,
  height: 206.326,
  figure: { x: 59.7676, y: 0, w: 86.7895, h: 206.3244 },
} as const;

/**
 * Map the FIGURE bbox (not the whole image) onto a target box in SVG user units.
 *
 * sx = target.w / figure.w
 * sy = target.h / figure.h
 * imageWidth  = image.width  * sx
 * imageHeight = image.height * sy
 * imageX      = target.x - figure.x * sx
 * imageY      = target.y - figure.y * sy
 */
export function fitFigureToBox(
  target: Rect,
  figure: FigureBox = BODY_IMAGE.figure,
  imgSize: ImageSize = BODY_IMAGE,
): FittedImage {
  const safeFigureW = figure.w > 0 ? figure.w : 1;
  const safeFigureH = figure.h > 0 ? figure.h : 1;
  const sx = target.width / safeFigureW;
  const sy = target.height / safeFigureH;

  return {
    x: target.x - figure.x * sx,
    y: target.y - figure.y * sy,
    width: imgSize.width * sx,
    height: imgSize.height * sy,
    scaleX: sx,
    scaleY: sy,
  };
}

/**
 * Apply the user calibration on top of an auto-fitted box. Stretch scales
 * around the box centre so x/y offsets stay predictable.
 */
export function applyBoxTransform(
  base: Rect,
  stretchX: number,
  stretchY: number,
  offsetX: number,
  offsetY: number,
): Rect {
  const cx = base.x + base.width / 2;
  const cy = base.y + base.height / 2;
  const width = base.width * stretchX;
  const height = base.height * stretchY;
  return {
    x: cx - width / 2 + offsetX,
    y: cy - height / 2 + offsetY,
    width,
    height,
  };
}

/** Union of two rectangles. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}
