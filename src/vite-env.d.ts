/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BAIDU_OCR_API_KEY: string;
  readonly VITE_PORT: string;
  readonly VITE_ENABLE_VCONSOLE: string;
  readonly VITE_TTS_ENGINE: 'web' | 'qwen';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

