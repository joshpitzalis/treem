import { useRef, useState } from "react"
import {
  assignMessageToCategory,
  clearMessageCategoryAssignment,
  createCategoryAndAssign,
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
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const newCategoryInputRef = useRef<HTMLInputElement>(null)

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

    resetExpandedUi()
    await props.onStateChange(nextState)
  }

  async function handleCreateCategory() {
    try {
      const nextState = createCategoryAndAssign({
        state: props.state,
        guildId: props.guildId,
        messageId: props.messageId,
        categoryName: newCategoryInputRef.current?.value ?? newCategoryName
      }).state

      resetExpandedUi()
      await props.onStateChange(nextState)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create category"
      setErrorMessage(message)
    }
  }

  function resetExpandedUi() {
    setIsPickerOpen(false)
    setIsCreateFormOpen(false)
    setNewCategoryName("")
    setErrorMessage(null)
  }

  return (
    <div data-treem-role="category-control" className="treem-category-control">
      <button
        type="button"
        data-treem-role="category-toggle"
        className="treem-category-toggle"
        onClick={() => {
          setErrorMessage(null)
          setIsPickerOpen((currentValue) => !currentValue)
        }}
      >
        {currentLabel}
      </button>
      {isPickerOpen ? (
        <div
          data-treem-role="category-picker"
          className="treem-category-picker"
        >
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
          <button
            type="button"
            data-treem-role="category-create-toggle"
            className="treem-category-create-toggle"
            onClick={() => {
              setErrorMessage(null)
              setIsCreateFormOpen((currentValue) => !currentValue)
            }}
          >
            New
          </button>
          {isCreateFormOpen ? (
            <div
              data-treem-role="category-create-form"
              className="treem-category-create-form"
            >
              <input
                type="text"
                data-treem-role="category-create-input"
                className="treem-category-create-input"
                ref={newCategoryInputRef}
                value={newCategoryName}
                placeholder="New category"
                onChange={(event) => {
                  setNewCategoryName(event.currentTarget.value)
                  if (errorMessage) setErrorMessage(null)
                }}
              />
              <button
                type="button"
                data-treem-role="category-create-submit"
                className="treem-category-create-submit"
                onClick={async () => {
                  await handleCreateCategory()
                }}
              >
                Save
              </button>
            </div>
          ) : null}
          {errorMessage ? (
            <p
              data-treem-role="category-create-error"
              className="treem-category-create-error"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
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
