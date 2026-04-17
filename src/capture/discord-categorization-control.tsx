import { useState } from "react"
import {
  assignMessageToCategory,
  clearMessageCategoryAssignment,
  listGuildCategories,
  UNCATEGORIZED_CATEGORY_ID
} from "../shared/category-state"
import type { LeaderboardState } from "../shared/types"

interface DiscordCategorizationControlProps {
  guildId: string
  messageId: string
  state: LeaderboardState
  onStateChange: (state: LeaderboardState) => Promise<void>
}

export function DiscordCategorizationControl(
  props: DiscordCategorizationControlProps
) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  const categories = listGuildCategories(props.state, props.guildId)
  const currentLabel = readCurrentCategoryLabel(props.state, props.messageId)

  async function handleCategoryChange(categoryId: string) {
    if (!categoryId) return

    const nextState =
      categoryId === UNCATEGORIZED_CATEGORY_ID
        ? clearMessageCategoryAssignment({
            state: props.state,
            guildId: props.guildId,
            messageId: props.messageId
          }).state
        : assignMessageToCategory({
            state: props.state,
            guildId: props.guildId,
            messageId: props.messageId,
            categoryId
          }).state

    setIsPickerOpen(false)
    await props.onStateChange(nextState)
  }

  return (
    <div data-treem-role="category-control" className="treem-category-control">
      <button
        type="button"
        data-treem-role="category-toggle"
        className="treem-category-toggle"
        onClick={() => {
          setIsPickerOpen((currentValue) => !currentValue)
        }}
      >
        {currentLabel}
      </button>
      {isPickerOpen ? (
        <select
          data-treem-role="category-select"
          className="treem-category-select"
          defaultValue=""
          onChange={async (event) => {
            await handleCategoryChange(event.currentTarget.value)
          }}
        >
          <option value="">Choose category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={UNCATEGORIZED_CATEGORY_ID}>Uncategorized</option>
        </select>
      ) : null}
    </div>
  )
}

function readCurrentCategoryLabel(
  state: LeaderboardState,
  messageId: string
): string {
  const assignment = state.messageCategoryAssignments.find(
    (candidate) => candidate.messageId === messageId
  )
  if (!assignment) return "Categorize"

  const category = state.categories.find(
    (candidate) => candidate.id === assignment.categoryId
  )
  return category ? `Category: ${category.name}` : "Categorize"
}
