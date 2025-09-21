import logger from "./logger";

const loadedFonts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();

interface FontVariant {
  weight: number;
  style: "normal" | "italic";
  file: string;
}

const FONT_VARIANTS: Record<string, FontVariant[]> = {
  Inter: [
    { weight: 400, style: "normal", file: "Inter-Regular.woff2" },
    { weight: 700, style: "normal", file: "Inter-Bold.woff2" },
    { weight: 400, style: "italic", file: "Inter-Italic.woff2" },
    { weight: 700, style: "italic", file: "Inter-BoldItalic.woff2" },
  ],
  Roboto: [
    { weight: 400, style: "normal", file: "Roboto-Regular.woff2" },
    { weight: 700, style: "normal", file: "Roboto-Bold.woff2" },
    { weight: 400, style: "italic", file: "Roboto-Italic.woff2" },
    { weight: 700, style: "italic", file: "Roboto-BoldItalic.woff2" },
  ],
  "Open Sans": [
    { weight: 400, style: "normal", file: "OpenSans-Regular.woff2" },
    { weight: 700, style: "normal", file: "OpenSans-Bold.woff2" },
    { weight: 400, style: "italic", file: "OpenSans-Italic.woff2" },
    { weight: 700, style: "italic", file: "OpenSans-BoldItalic.woff2" },
  ],
  Lato: [
    { weight: 400, style: "normal", file: "Lato-Regular.woff2" },
    { weight: 700, style: "normal", file: "Lato-Bold.woff2" },
    { weight: 400, style: "italic", file: "Lato-Italic.woff2" },
    { weight: 700, style: "italic", file: "Lato-BoldItalic.woff2" },
  ],
  Montserrat: [
    { weight: 400, style: "normal", file: "Montserrat-Regular.woff2" },
    { weight: 700, style: "normal", file: "Montserrat-Bold.woff2" },
    { weight: 400, style: "italic", file: "Montserrat-Italic.woff2" },
    { weight: 700, style: "italic", file: "Montserrat-BoldItalic.woff2" },
  ],
  Poppins: [
    { weight: 400, style: "normal", file: "Poppins-Regular.woff2" },
    { weight: 700, style: "normal", file: "Poppins-Bold.woff2" },
    { weight: 400, style: "italic", file: "Poppins-Italic.woff2" },
    { weight: 700, style: "italic", file: "Poppins-BoldItalic.woff2" },
  ],
  "Source Sans Pro": [
    { weight: 400, style: "normal", file: "SourceSansPro-Regular.woff2" },
    { weight: 700, style: "normal", file: "SourceSansPro-Bold.woff2" },
    { weight: 400, style: "italic", file: "SourceSansPro-Italic.woff2" },
    { weight: 700, style: "italic", file: "SourceSansPro-BoldItalic.woff2" },
  ],
  Nunito: [
    { weight: 400, style: "normal", file: "Nunito-Regular.woff2" },
    { weight: 700, style: "normal", file: "Nunito-Bold.woff2" },
    { weight: 400, style: "italic", file: "Nunito-Italic.woff2" },
    { weight: 700, style: "italic", file: "Nunito-BoldItalic.woff2" },
  ],
  Raleway: [
    { weight: 400, style: "normal", file: "Raleway-Regular.woff2" },
    { weight: 700, style: "normal", file: "Raleway-Bold.woff2" },
    { weight: 400, style: "italic", file: "Raleway-Italic.woff2" },
    { weight: 700, style: "italic", file: "Raleway-BoldItalic.woff2" },
  ],
  Ubuntu: [
    { weight: 400, style: "normal", file: "Ubuntu-Regular.woff2" },
    { weight: 700, style: "normal", file: "Ubuntu-Bold.woff2" },
    { weight: 400, style: "italic", file: "Ubuntu-Italic.woff2" },
    { weight: 700, style: "italic", file: "Ubuntu-BoldItalic.woff2" },
  ],
};

export function loadFont(
  fontName: string,
  fontFile: string,
  weight: number = 400,
  style: "normal" | "italic" = "normal"
): Promise<void> {
  const fontKey = `${fontName}-${weight}-${style}`;

  if (loadedFonts.has(fontKey)) {
    return Promise.resolve();
  }

  if (loadingPromises.has(fontKey)) {
    return loadingPromises.get(fontKey)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.fonts.check(`${weight} ${style} 16px "${fontName}"`)) {
      loadedFonts.add(fontKey);
      resolve();
      return;
    }

    const fontFace = new FontFace(
      fontName,
      `url(/fonts/${fontFile}) format('woff2')`,
      {
        display: "swap",
        weight: weight.toString(),
        style: style,
      }
    );

    fontFace
      .load()
      .then(() => {
        document.fonts.add(fontFace);
        loadedFonts.add(fontKey);
        resolve();
      })
      .catch((error) => {
        logger.warn(
          `Failed to load font ${fontName} (${weight} ${style}):`,
          error
        );
        loadedFonts.add(fontKey);
        resolve();
      })
      .finally(() => {
        loadingPromises.delete(fontKey);
      });
  });

  loadingPromises.set(fontKey, promise);
  return promise;
}

export function preloadFont(
  fontName: string,
  fontFile: string,
  weight: number = 400,
  style: "normal" | "italic" = "normal"
): void {
  const fontKey = `${fontName}-${weight}-${style}`;

  if (loadedFonts.has(fontKey) || loadingPromises.has(fontKey)) {
    return;
  }

  const existingLink = document.querySelector(
    `link[href="/fonts/${fontFile}"]`
  );
  if (existingLink) return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = `/fonts/${fontFile}`;
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";

  link.onload = () => {
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    }, 5000);
  };

  link.onerror = () => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  };

  document.head.appendChild(link);
}

export function isFontLoaded(
  fontName: string,
  weight: number = 400,
  style: "normal" | "italic" = "normal"
): boolean {
  const fontKey = `${fontName}-${weight}-${style}`;
  return loadedFonts.has(fontKey);
}

function getFontVariants(fontName: string): FontVariant[] {
  return FONT_VARIANTS[fontName] || [];
}

export function loadFontVariants(
  fontName: string,
  bold: boolean,
  italic: boolean
): Promise<(void | Error)[]> {
  const variants = getFontVariants(fontName);
  const promises: Promise<void | Error>[] = [];

  const regular = variants.find(
    (v) => v.weight === 400 && v.style === "normal"
  );
  if (regular) {
    promises.push(
      loadFont(fontName, regular.file, 400, "normal").catch((e) => e)
    );
  } else {
    logger.warn(`⚠️ No regular font found for "${fontName}"`);
  }

  if (bold) {
    const boldVariant = variants.find(
      (v) => v.weight === 700 && v.style === "normal"
    );
    if (boldVariant) {
      promises.push(
        loadFont(fontName, boldVariant.file, 700, "normal").catch((e) => {
          logger.error("Failed to load bold font:", fontName, e);
          return e;
        })
      );
    }
  }

  if (italic) {
    const italicVariant = variants.find(
      (v) => v.weight === 400 && v.style === "italic"
    );
    if (italicVariant) {
      promises.push(
        loadFont(fontName, italicVariant.file, 400, "italic").catch((e) => {
          logger.error("Failed to load italic font:", fontName, e);
          return e;
        })
      );
    }
  }

  if (bold && italic) {
    const boldItalicVariant = variants.find(
      (v) => v.weight === 700 && v.style === "italic"
    );
    if (boldItalicVariant) {
      promises.push(
        loadFont(fontName, boldItalicVariant.file, 700, "italic").catch((e) => {
          logger.error("Failed to load bold italic font:", fontName, e);
          return e;
        })
      );
    }
  }

  return Promise.all(promises);
}

export function preloadCommonVariants(fontName: string): void {
  const variants = getFontVariants(fontName);

  const regular = variants.find(
    (v) => v.weight === 400 && v.style === "normal"
  );
  const bold = variants.find((v) => v.weight === 700 && v.style === "normal");
  const italic = variants.find((v) => v.weight === 400 && v.style === "italic");

  if (regular) preloadFont(fontName, regular.file, 400, "normal");
  if (bold) preloadFont(fontName, bold.file, 700, "normal");
  if (italic) preloadFont(fontName, italic.file, 400, "italic");
}
