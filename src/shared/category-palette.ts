export function createCategoryPalette(categoryId: string): {
  start: string
  end: string
  accent: string
} {
  const hash = hashText(categoryId)
  const hue = 18 + (hash % 18)
  const saturation = 62 + (hash % 8)
  const startLightness = 52 + (hash % 7)
  const endLightness = 42 + (hash % 6)

  return {
    start: `hsl(${hue} ${saturation}% ${startLightness}%)`,
    end: `hsl(${Math.max(10, hue - 4)} ${Math.min(
      78,
      saturation + 6
    )}% ${endLightness}%)`,
    accent: `hsla(${hue + 8} ${Math.max(46, saturation - 10)}% ${Math.min(
      72,
      startLightness + 10
    )}% / 0.18)`
  }
}

function hashText(value: string): number {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return hash
}
