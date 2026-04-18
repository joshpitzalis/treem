declare const chrome: {
  storage: {
    local: {
      get(
        keys?: string | string[] | Record<string, unknown> | null
      ): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
    }
    onChanged: {
      addListener(
        callback: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string
        ) => void
      ): void
    }
  }
}

declare const __TREEM_EXTENSION_VERSION__: string
declare const __TREEM_BUILD_STAMP__: string

declare module "*.css" {
  const css: string
  export default css
}

declare module "*.css?inline" {
  const css: string
  export default css
}
