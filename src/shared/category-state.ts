import type {
  CategoryRecord,
  LeaderboardState,
  MessageCategoryAssignment
} from "./types"

const UNCATEGORIZED_CATEGORY_ID = "__uncategorized__"

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

  const now = input.now ?? new Date().toISOString()
  assertMessageInGuild(input.state, input.guildId, input.messageId)
  const normalizedName = normalizeCategoryName(categoryName)
  const existingCategory = findCategoryByNormalizedName(
    input.state,
    input.guildId,
    normalizedName
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
    assignment: createAssignment({
      guildId: input.guildId,
      messageId: input.messageId,
      categoryId: category.id,
      assignedAt: now
    })
  }
}

export function assignMessageToCategory(input: {
  state: LeaderboardState
  guildId: string
  messageId: string
  categoryId: string
  now?: string
}): {
  state: LeaderboardState
  assignment: MessageCategoryAssignment
} {
  const now = input.now ?? new Date().toISOString()
  assertMessageInGuild(input.state, input.guildId, input.messageId)
  assertCategoryInGuild(input.state, input.guildId, input.categoryId)

  const assignment = createAssignment({
    guildId: input.guildId,
    messageId: input.messageId,
    categoryId: input.categoryId,
    assignedAt: now
  })

  return {
    state: {
      ...input.state,
      messageCategoryAssignments: upsertAssignment(
        input.state.messageCategoryAssignments,
        assignment
      ),
      updatedAt: now
    },
    assignment
  }
}

export function clearMessageCategoryAssignment(input: {
  state: LeaderboardState
  guildId: string
  messageId: string
  now?: string
}): {
  state: LeaderboardState
} {
  const now = input.now ?? new Date().toISOString()
  assertMessageInGuild(input.state, input.guildId, input.messageId)

  return {
    state: {
      ...input.state,
      messageCategoryAssignments: input.state.messageCategoryAssignments.filter(
        (assignment) => assignment.messageId !== input.messageId
      ),
      updatedAt: now
    }
  }
}

export function listGuildCategories(
  state: LeaderboardState,
  guildId: string
): CategoryRecord[] {
  return state.categories
    .filter((category) => category.guildId === guildId)
    .sort((left, right) => left.name.localeCompare(right.name))
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

function createAssignment(input: {
  guildId: string
  messageId: string
  categoryId: string
  assignedAt: string
}): MessageCategoryAssignment {
  return {
    messageId: input.messageId,
    guildId: input.guildId,
    categoryId: input.categoryId,
    assignedAt: input.assignedAt
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

function assertMessageInGuild(
  state: LeaderboardState,
  guildId: string,
  messageId: string
): void {
  const message = state.messages.find((candidate) => candidate.id === messageId)
  if (!message || message.guildId !== guildId) {
    throw new Error("Message must exist in selected server before assignment")
  }
}

function assertCategoryInGuild(
  state: LeaderboardState,
  guildId: string,
  categoryId: string
): void {
  if (categoryId === UNCATEGORIZED_CATEGORY_ID) return

  const category = state.categories.find((candidate) => candidate.id === categoryId)
  if (!category || category.guildId !== guildId) {
    throw new Error("Category must exist in selected server before assignment")
  }
}

function findCategoryByNormalizedName(
  state: LeaderboardState,
  guildId: string,
  normalizedName: string
): CategoryRecord | undefined {
  return state.categories.find(
    (category) =>
      category.guildId === guildId &&
      category.normalizedName === normalizedName
  )
}

export { UNCATEGORIZED_CATEGORY_ID }
