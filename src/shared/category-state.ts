import type {
  CategoryRecord,
  LeaderboardState,
  MessageCategoryAssignment
} from "./types"

export function createCategoryAndAssign(input: {
  state: LeaderboardState
  guildId: string
  messageId: string
  categoryName: string
  now?: string
}): {
  state: LeaderboardState
  category: CategoryRecord
  assignment: MessageCategoryAssignment
} {
  const categoryName = input.categoryName.trim()
  if (!categoryName) {
    throw new Error("Category name required")
  }

  const message = input.state.messages.find(
    (candidate) => candidate.id === input.messageId
  )
  if (!message || message.guildId !== input.guildId) {
    throw new Error("Message must exist in selected server before assignment")
  }

  const now = input.now ?? new Date().toISOString()
  const normalizedName = normalizeCategoryName(categoryName)
  const existingCategory = input.state.categories.find(
    (category) =>
      category.guildId === input.guildId &&
      category.normalizedName === normalizedName
  )
  const category =
    existingCategory ??
    createCategory({
      guildId: input.guildId,
      name: categoryName,
      normalizedName,
      now
    })

  const categories = existingCategory
    ? input.state.categories
    : [...input.state.categories, category]
  const assignment: MessageCategoryAssignment = {
    messageId: input.messageId,
    guildId: input.guildId,
    categoryId: category.id,
    assignedAt: now
  }
  const assignments = upsertAssignment(
    input.state.messageCategoryAssignments,
    assignment
  )

  return {
    state: {
      ...input.state,
      categories,
      messageCategoryAssignments: assignments,
      updatedAt: now
    },
    category,
    assignment
  }
}

function createCategory(input: {
  guildId: string
  name: string
  normalizedName: string
  now: string
}): CategoryRecord {
  return {
    id: `cat:${input.guildId}:${input.normalizedName}`,
    guildId: input.guildId,
    name: input.name,
    normalizedName: input.normalizedName,
    createdAt: input.now
  }
}

function upsertAssignment(
  assignments: MessageCategoryAssignment[],
  nextAssignment: MessageCategoryAssignment
): MessageCategoryAssignment[] {
  const remainingAssignments = assignments.filter(
    (assignment) => assignment.messageId !== nextAssignment.messageId
  )

  return [...remainingAssignments, nextAssignment]
}

function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase()
}
