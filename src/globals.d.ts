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
