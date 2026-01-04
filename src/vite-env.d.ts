/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BAIDU_OCR_API_KEY: string;
  readonly VITE_PORT: string;
  readonly VITE_ENABLE_VCONSOLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

