import { PAGE_HEIGHT, PAGE_WIDTH } from '@betterfit/pdf-templates';
import { chromium, type Browser } from 'playwright';

/**
 * Rend un PDF depuis du HTML, avec Chromium sans interface.
 *
 * Côté serveur, et pas dans l'app : c'est la seule façon d'obtenir un rendu
 * **identique** sur un iPhone, un Android et un navigateur, avec du texte
 * sélectionnable. Un PDF dessiné sur l'appareil dépendrait des polices
 * installées et du moteur de rendu.
 */

/**
 * Le navigateur est démarré une fois et réutilisé : son lancement coûte près
 * d'une seconde, et un coach qui exporte plusieurs programmes d'affilée ne
 * doit pas la payer à chaque fois.
 */
let browser: Browser | null = null;
let starting: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;

  // Deux exports simultanés ne doivent pas lancer deux navigateurs.
  starting ??= chromium.launch({ args: ['--no-sandbox'] }).then((launched) => {
    browser = launched;
    starting = null;
    return launched;
  });

  return starting;
}

/** Ferme le navigateur. Appelé à l'arrêt du serveur. */
export async function closePdfRenderer(): Promise<void> {
  const current = browser;
  browser = null;

  await current?.close();
}

export async function renderPdf(html: string): Promise<Buffer> {
  const page = await (await getBrowser()).newPage({
    viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  });

  try {
    // `domcontentloaded` plutôt que `networkidle` : les polices viennent de
    // Google Fonts, et si le serveur n'a pas de réseau on ne doit pas
    // attendre indéfiniment. La mise en page ne dépend pas de la police.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // On laisse une chance aux polices d'arriver, sans bloquer dessus.
    // L'expression est passée en chaîne : elle s'exécute dans le navigateur,
    // et le serveur n'a pas les types du DOM.
    await page.evaluate('document.fonts.ready').catch(() => undefined);

    return await page.pdf({
      width: `${PAGE_WIDTH}px`,
      height: `${PAGE_HEIGHT}px`,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await page.close();
  }
}

/**
 * Capture chaque page en image.
 *
 * Sert à regarder la mise en page pendant le développement : un PDF demande
 * un lecteur, une image se regarde partout.
 */
export async function screenshotPages(
  html: string,
  outDir: string,
  prefix: string,
): Promise<string[]> {
  const { resolve } = await import('node:path');
  const page = await (await getBrowser()).newPage({
    viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
  });

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate('document.fonts.ready').catch(() => undefined);

    const sections = await page.locator('section.pg').all();
    const files: string[] = [];

    for (const [index, section] of sections.entries()) {
      const file = resolve(outDir, `${prefix}-${index + 1}.png`);
      await section.screenshot({ path: file });
      files.push(file);
    }

    return files;
  } finally {
    await page.close();
  }
}
