/// <reference types="connect" />
/// <reference types="node" />
import { HandleFunction, NextHandleFunction } from "connect";
import { Stats } from "fs";

declare function staticExpiry(app: staticExpiry.app | null | undefined, config: staticExpiry.config): staticExpiry.Middleware;

declare namespace staticExpiry {
  type fileFilterCb = (fileName: string, stat: Stats) => boolean;
  type furl = (filePath: string) => string;

  interface Middleware extends NextHandleFunction {
    furl: furl
  }

  // Static expiry works with express and connect, which return app objects
  // of different shapes. So app.use() is the common interface relied on.
  export type app = {
    use(route: string, fn: HandleFunction): app;
  };

  export type config = {
    duration?: number;
    conditional?: "none" | "etag" | "last-modified" | "both";
    unconditional?: "none" | "max-age" | "expires" | "both";
    cacheControl?: string | false | null;
    dir?: string;
    fingerprint?: furl;
    location?: 'prefile' | 'postfile' | 'query' | 'path';
    host?: null | string | string[];
    loadCache?: 'startup' | 'furl' | { at: 'startup', callback: fileFilterCb };
    debug?: boolean;
  };

  export function clearCache(): void;
}

export= staticExpiry;
