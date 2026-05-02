import { Asset, AssetManager, SpriteFrame, assetManager } from "cc";

export enum EBundleType {
    CONFIG = 'config',
    /** UI 预制体等资源（Creator 中 bundle 名需一致，如 ui） */
    ui = 'ui',
    SOUND = 'sound',
    ANIM = 'anim',
}

export class ResManager {
    private static _bundleCache = new Map<EBundleType, AssetManager.Bundle>();
    private static _bundleLoading = new Map<EBundleType, Promise<AssetManager.Bundle>>();

    private static _assetCache = new Map<string, { asset: Asset; refs: number }>();
    private static _assetLoading = new Map<string, Promise<Asset>>();

    private static _assetKey(bundleType: EBundleType, path: string) {
        return `${bundleType}:${path}`;
    }

    private static _normalizePath(res: string, type?: any) {
        let p = res || "";
        const dot = p.lastIndexOf(".");
        if (dot > 0) p = p.substring(0, dot);
        // 兼容 Creator 对 SpriteFrame 子资源的路径规则
        if (type === SpriteFrame) p = `${p}/spriteFrame`;
        return p;
    }

    static loadBundle(bundleType: EBundleType): Promise<AssetManager.Bundle> {
        const cached = this._bundleCache.get(bundleType);
        if (cached) return Promise.resolve(cached);

        const loading = this._bundleLoading.get(bundleType);
        if (loading) return loading;

        const p = new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(bundleType, (err, bundle) => {
                if (err || !bundle) {
                    const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
                    reject(new Error(`[ResManager] loadBundle failed: ${bundleType}, ${msg}`));
                    return;
                }
                this._bundleCache.set(bundleType, bundle);
                resolve(bundle);
            });
        });

        // 兼容较低的 TS lib：避免使用 Promise.finally
        p.then(
            () => this._bundleLoading.delete(bundleType),
            () => this._bundleLoading.delete(bundleType)
        );

        this._bundleLoading.set(bundleType, p);
        return p;
    }

    static loadAsset(bundleType: EBundleType, path: string): Promise<Asset>;
    static loadAsset<T extends Asset>(bundleType: EBundleType, path: string, type: { new(...args: any[]): T } | any): Promise<T>;
    static loadAsset<T extends Asset>(bundleType: EBundleType, path: string, type?: { new(...args: any[]): T } | any): Promise<T> {
        const normalizedPath = this._normalizePath(path, type);
        const key = this._assetKey(bundleType, normalizedPath);
        const cached = this._assetCache.get(key);
        if (cached) {
            cached.refs += 1;
            (cached.asset as any).addRef?.();
            return Promise.resolve(cached.asset as T);
        }

        const loading = this._assetLoading.get(key) as unknown as Promise<T> | undefined;
        if (loading) {
            return loading.then((asset) => {
                const rec = this._assetCache.get(key);
                if (rec) {
                    rec.refs += 1;
                    (rec.asset as any).addRef?.();
                }
                return asset as T;
            });
        }

        const p = this.loadBundle(bundleType)
            .then((bundle) => {
                return new Promise<T>((resolve, reject) => {
                    // 传入 type 可以减少同名资源歧义
                    const cb = (err: any, asset: any) => {
                        if (err || !asset) {
                            const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
                            reject(new Error(`[ResManager] loadAsset failed: ${bundleType}:${normalizedPath}, ${msg}`));
                            return;
                        }
                        const a = asset as Asset;
                        // 首次缓存：refs=1，并持有引擎引用，避免被提前回收
                        (a as any).addRef?.();
                        this._assetCache.set(key, { asset: a, refs: 1 });
                        resolve(a as T);
                    };
                    if (type) (bundle as any).load(normalizedPath, type as any, cb);
                    else bundle.load(normalizedPath, cb);
                });
            });

        // 兼容较低 TS lib（不依赖 Promise.finally）
        p.then(
            () => this._assetLoading.delete(key),
            () => this._assetLoading.delete(key)
        );

        this._assetLoading.set(key, p as unknown as Promise<Asset>);
        return p;
    }

    /**
     * 加载某个目录下的资源列表（用于启动时批量预加载）
     * - 默认不做“按路径复用”的细粒度缓存（loadDir 返回的是一批资源，路径粒度不稳定）
     * - 会对返回的每个 Asset addRef，防止被回收；释放请使用 ResManager.releaseLoadedAssets()
     */
    static loadDir<T extends Asset>(
        bundleType: EBundleType,
        dir: string,
        type: { new(...args: any[]): T } | any,
        onProgress?: (finished: number, total: number) => void,
    ): Promise<T[]> {
        const normalizedDir = (dir || "").replace(/\\/g, "/");
        return this.loadBundle(bundleType).then((bundle) => {
            return new Promise<T[]>((resolve, reject) => {
                (bundle as any).loadDir(
                    normalizedDir,
                    type,
                    (finished: number, total: number) => onProgress?.(finished, total),
                    (err: any, res: any[]) => {
                        if (err) {
                            const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
                            reject(new Error(`[ResManager] loadDir failed: ${bundleType}:${normalizedDir}, ${msg}`));
                            return;
                        }
                        const assets = (res || []) as T[];
                        for (const a of assets) {
                            try { (a as any).addRef?.(); } catch { }
                        }
                        resolve(assets);
                    }
                );
            });
        });
    }

    /** 释放通过 ResManager.loadDir() 加载并 addRef 的资源 */
    static releaseLoadedAssets(assets: Asset[]) {
        for (const a of assets || []) {
            const anyA: any = a as any;
            if (typeof anyA.decRef === "function") {
                try { anyA.decRef(); } catch { }
            } else {
                try { assetManager.releaseAsset(a); } catch { }
            }
        }
    }

    /**
     * 释放通过 ResManager.loadAsset() 动态加载的资源引用
     * - 同一个 (bundleType,path) 被多次 loadAsset，会累计 refs，需要对应次数 releaseAsset 才会真正释放
     */
    /**
     * 与 loadAsset(path, type) 使用相同的路径归一化规则释放引用（避免 key 与缓存不一致）
     */
    static releaseLoadedAsset(bundleType: EBundleType, rawPath: string, assetType?: any) {
        const normalizedPath = this._normalizePath(rawPath, assetType);
        return this.releaseAsset(bundleType, normalizedPath);
    }

    static releaseAsset(bundleType: EBundleType, path: string) {
        const key = this._assetKey(bundleType, path);
        const rec = this._assetCache.get(key);
        if (!rec) return;

        rec.refs -= 1;
        if (rec.refs > 0) return;

        this._assetCache.delete(key);

        const a: any = rec.asset as any;
        if (typeof a.decRef === "function") {
            a.decRef();
        } else {
            try { assetManager.releaseAsset(rec.asset); } catch { }
        }
    }

    /** 释放某个 bundle 下当前由 ResManager 缓存的所有资源 */
    static releaseAssetsInBundle(bundleType: EBundleType) {
        const prefix = `${bundleType}:`;
        for (const [key, rec] of this._assetCache) {
            if (!key.startsWith(prefix)) continue;
            this._assetCache.delete(key);
            const a: any = rec.asset as any;
            if (typeof a.decRef === "function") {
                // rec.refs 可能 > 1，逐次 decRef
                for (let i = 0; i < Math.max(1, rec.refs); i++) a.decRef();
            } else {
                try { assetManager.releaseAsset(rec.asset); } catch { }
            }
        }
    }

    /** 释放 bundle（注意：bundle 释放策略要结合你项目是否会复用该 bundle） */
    static releaseBundle(bundleType: EBundleType) {
        this.releaseAssetsInBundle(bundleType);
        const bundle = this._bundleCache.get(bundleType);
        if (bundle) {
            try { (bundle as any).releaseAll?.(); } catch { }
        }
        this._bundleCache.delete(bundleType);
    }
}


