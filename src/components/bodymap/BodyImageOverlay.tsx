import { useEffect, useId, useState } from "react";
import { BODY_IMAGE, fitFigureToBox, type Rect } from "../../data/bodyImage";

export interface BodyImageOverlayProps {
  /** Auto-fitted figure box in SVG user units (the 400 x 800 space). */
  placement: Rect;
  /** 0-1, defaults to 1. */
  opacity?: number;
  /** Mirror horizontally around the placement box centre. */
  flipX?: boolean;
  /** Optional rotation in degrees around the placement box centre. */
  rotation?: number;
  /** Optional id of a clipPath element defined by the parent SVG. */
  clip?: string;
  /** Optional X-ray "screen" blend mode. Defaults to off. */
  blend?: boolean;
  /** Soft cyan glow behind the figure. Defaults to on. */
  glow?: boolean;
}

/**
 * Renders the human silhouette so that the FIGURE inside the image - not the
 * image canvas - fills the supplied target box. The source SVG is solid black,
 * so a flood/composite filter recolours it into a cool X-ray silhouette that
 * stays visible on the dark stage. The overlay never receives pointer events,
 * so region hit areas keep working underneath.
 */
export function BodyImageOverlay({
  placement,
  opacity = 1,
  flipX = false,
  rotation = 0,
  clip,
  blend = false,
  glow = true,
}: BodyImageOverlayProps) {
  const [ready, setReady] = useState(false);
  const reactId = useId();
  const filterId = `bm-image-tint-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // Decode before first paint so the figure does not flash in late.
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    const done = () => {
      if (!cancelled) setReady(true);
    };
    image.onload = done;
    image.onerror = done;
    image.src = BODY_IMAGE.src;
    if (image.complete && image.naturalWidth > 0) done();
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  if (!ready) return null;

  const fitted = fitFigureToBox(placement);
  const centreX = placement.x + placement.width / 2;
  const centreY = placement.y + placement.height / 2;

  const transforms: string[] = [];
  if (Number.isFinite(rotation) && rotation !== 0) {
    transforms.push(`rotate(${rotation.toFixed(2)} ${centreX} ${centreY})`);
  }
  if (flipX) transforms.push(`translate(${centreX * 2} 0) scale(-1 1)`);

  return (
    <g
      opacity={Math.min(1, Math.max(0, opacity))}
      clipPath={clip ? `url(#${clip})` : undefined}
      pointerEvents="none"
      aria-hidden="true"
      style={blend ? { mixBlendMode: "screen" } : undefined}
    >
      <defs>
        <filter
          id={filterId}
          x="-35%"
          y="-25%"
          width="170%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodColor="#9fe8f5" floodOpacity="0.5" result="body-tint" />
          <feComposite in="body-tint" in2="SourceAlpha" operator="in" result="body-shape" />
          {glow && (
            <>
              <feGaussianBlur in="body-shape" stdDeviation="6" result="body-glow" />
              <feMerge>
                <feMergeNode in="body-glow" />
                <feMergeNode in="body-shape" />
              </feMerge>
            </>
          )}
        </filter>
      </defs>
      <image
        {...{ draggable: false }}
        href={BODY_IMAGE.src}
        x={fitted.x}
        y={fitted.y}
        width={fitted.width}
        height={fitted.height}
        preserveAspectRatio="none"
        pointerEvents="none"
        focusable="false"
        transform={transforms.length > 0 ? transforms.join(" ") : undefined}
        filter={`url(#${filterId})`}
      />
    </g>
  );
}
