const svg = (body: string, size = 320) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`)}")`;
// Neutral, seamless material tiles: color always comes from the selected theme.
const noise = (frequency: string, octaves: number, seed: number, contrast: number) => `<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${contrast}" intercept="${.5 - contrast / 2}"/><feFuncG type="linear" slope="${contrast}" intercept="${.5 - contrast / 2}"/><feFuncB type="linear" slope="${contrast}" intercept="${.5 - contrast / 2}"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#n)"/>`;

const surfaces: Record<string, { image: string; size: string; description: string }> = {
  "None": { image: "none", size: "auto", description: "Clean, untextured surfaces" },
  "Fine grain": { image: svg(noise(".65", 2, 7, .55)), size: "240px 240px", description: "Soft, fine matte grain" },
  "Slate / stone": { image: svg(noise(".018 .055", 4, 19, 1.1)), size: "480px 480px", description: "Natural mineral layers, without deep grooves" },
  "Leather": { image: svg(`<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".19" numOctaves="3" seed="11" stitchTiles="stitch"/><feDiffuseLighting surfaceScale=".65" diffuseConstant="1" lighting-color="#888888"><feDistantLight azimuth="35" elevation="65"/></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#n)"/>`), size: "300px 300px", description: "Small, softly raised leather pores" },
  "Parchment": { image: svg(noise(".045 .14", 3, 31, .75) + `<g stroke="#b0b0b0" stroke-width=".5" opacity=".18"><path d="M20 50l38 9m65 85l51 -5m60 102l42 8m-215 31l48 -9m84 -246l31 7"/></g>`), size: "400px 400px", description: "Subtle paper fibers and mottling" },
  "Brushed metal": { image: svg(noise(".08 .7", 2, 43, .5)), size: "320px 320px", description: "Fine, irregular horizontal brushing" },
  "Woven cloth": { image: svg(`<rect width="16" height="16" fill="#777777"/><g fill="none" stroke-width="2" stroke-linecap="round"><path stroke="#999999" d="M0 2h16M0 10h16M2 0v16M10 0v16"/><path stroke="#666666" d="M2 0v4m0 4v4m8 -8v4m0 4v4M0 10h4m4 0h4M4 2h4m4 0h4"/><path stroke="#b0b0b0" stroke-width=".5" d="M0 1h16M0 9h16M1 0v16M9 0v16"/></g>`, 16), size: "16px 16px", description: "Interlaced threads, not a flat grid" },
};

export function surfaceTexture(name: string) { return surfaces[name] ?? surfaces.None; }
