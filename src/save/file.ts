// Files in the browser (SAVE-006): handing a life to the player as a download, and reading one they chose. Outside
// the engine, which only ever sees text. Neither throws into the UI.

/** The address of the last file handed over: it is let go on the next one, as no timer may drive the game. */
let lastUrl: string | undefined;

/** Saves `text` as a file the player keeps. False when the browser would not make or start the download. */
export function downloadText(fileName: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = url;
    return true;
  } catch {
    return false;
  }
}

/** The text in a file the player chose; null when it could not be read. */
export async function readText(file: File): Promise<string | null> {
  try {
    return await file.text();
  } catch {
    return null;
  }
}
