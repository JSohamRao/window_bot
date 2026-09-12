export interface AssetPreloadReport {
  loaded: readonly string[];
  failed: readonly string[];
}

export class AssetManager {
  private readonly loadedImages = new Map<string, HTMLImageElement>();

  public constructor(
    private readonly fallbackPath: string,
    private readonly emergencyFallbackPath: string
  ) {}

  public async preload(paths: readonly string[]): Promise<AssetPreloadReport> {
    const uniquePaths = [
      ...new Set([this.fallbackPath, this.emergencyFallbackPath, ...paths])
    ];
    const results = await Promise.all(
      uniquePaths.map(async (path) => ({
        path,
        loaded: await this.preloadImage(path)
      }))
    );

    return {
      loaded: results.filter((result) => result.loaded).map((result) => result.path),
      failed: results.filter((result) => !result.loaded).map((result) => result.path)
    };
  }

  public resolve(path: string): string {
    if (this.loadedImages.has(path)) {
      return path;
    }

    if (this.loadedImages.has(this.fallbackPath)) {
      return this.fallbackPath;
    }

    return this.emergencyFallbackPath;
  }

  private async preloadImage(path: string): Promise<boolean> {
    if (this.loadedImages.has(path)) {
      return true;
    }

    const image = new Image();
    image.decoding = "async";

    try {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error(`Unable to load sprite: ${path}`)),
          { once: true }
        );
        image.src = path;
      });

      await image.decode().catch(() => undefined);
      this.loadedImages.set(path, image);
      return true;
    } catch (error) {
      console.warn(`[THUKUNA] Sprite preload failed for ${path}.`, error);
      return false;
    }
  }
}
