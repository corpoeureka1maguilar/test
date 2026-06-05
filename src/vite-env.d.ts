/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const styles: Record<string, string>
  export default styles
}

