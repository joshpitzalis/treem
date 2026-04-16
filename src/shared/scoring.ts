export function scoreMessage(input: {
  contentLength: number
  reactionCount: number
  attachmentCount: number
  isReply: boolean
}): number {
  let score = 1

  if (input.isReply) score += 1
  if (input.attachmentCount > 0) score += 1
  score += Math.min(input.reactionCount, 3)

  if (input.contentLength > 280) score += 1
  if (input.contentLength < 8) score = Math.max(1, score - 0.5)

  return score
}
