// Keeping a life outside the game (SHARE-001, SHARE-002): copying text to the clipboard and drawing the share card
// as a PNG. Browser APIs, so outside the engine; nothing here throws into the UI, and nothing is sent anywhere.

/** Puts `text` on the clipboard. False when the browser has no clipboard here or would not let the page use it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A PNG of an SVG document of the given size, drawn on a canvas. Null when the browser cannot load the document as an
 * image or make a PNG of it. A data address, not a blob one, so that no browser counts the canvas as tainted.
 */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  } catch {
    return null;
  }
}
