import { useRef, useState } from "react"
import {
  assignMessageToCategory,
  clearMessageCategoryAssignment,
  createCategoryAndAssign,
  listGuildCategories,
  UNCATEGORIZED_CATEGORY_ID
} from "../shared/category-state"
import { createCategoryPalette } from "../shared/category-palette"
import type { LeaderboardState } from "../shared/types"
import { BadgeButton } from "./badge"

interface DiscordCategorizationControlProps {
  guildId: string
  messageId: string
  state: LeaderboardState
  onStateChange: (state: LeaderboardState) => Promise<void>
  onUiStateChange?: () => void
}

interface CategoryControlDraft {
  isPickerOpen: boolean
  isCreateFormOpen: boolean
  newCategoryName: string
}

const categoryControlDrafts = new Map<string, CategoryControlDraft>()

export function DiscordCategorizationControl(
  props: DiscordCategorizationControlProps
) {
  const initialDraft = readCategoryControlDraft(props.messageId)
  const [isPickerOpen, setIsPickerOpen] = useState(initialDraft.isPickerOpen)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(
    initialDraft.isCreateFormOpen
  )
  const [newCategoryName, setNewCategoryName] = useState(
    initialDraft.newCategoryName
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const newCategoryInputRef = useRef<HTMLInputElement>(null)

  const categories = listGuildCategories(props.state, props.guildId)
  const currentCategory = readCurrentCategory(props.state, props.messageId)
  const currentLabel = currentCategory?.name ?? "Categorize"
  const currentPalette = currentCategory
    ? createCategoryPalette(currentCategory.id)
    : null

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
    clearCategoryControlDraft(props.messageId)
    setIsPickerOpen(false)
    setIsCreateFormOpen(false)
    setNewCategoryName("")
    setErrorMessage(null)
  }

  function persistDraft(nextDraft: CategoryControlDraft): void {
    writeCategoryControlDraft(props.messageId, nextDraft)
  }

  return (
    <div
      data-treem-role="category-control"
      className="treem-category-control"
      onBeforeInputCapture={stopEventPropagation}
      onInputCapture={(event) => {
        stopEventPropagation(event)

        const inputTarget = event.target as
          | {
              tagName?: string
              dataset?: { treemRole?: string }
              value?: string
            }
          | null

        if (
          inputTarget?.tagName === "INPUT" &&
          inputTarget.dataset?.treemRole === "category-create-input"
        ) {
          persistDraft({
            isPickerOpen,
            isCreateFormOpen,
            newCategoryName: inputTarget.value ?? ""
          })
        }
      }}
      onKeyDownCapture={stopEventPropagation}
      onKeyUpCapture={stopEventPropagation}
    >
      <BadgeButton
        data-treem-role="category-toggle"
        data-treem-has-category={currentCategory ? "true" : "false"}
        className="treem-category-toggle"
        variant="secondary"
        style={
          currentPalette
            ? {
                background: `linear-gradient(135deg, ${currentPalette.start}, ${currentPalette.end})`,
                borderColor: currentPalette.end,
                boxShadow: `0 0 0 1px ${currentPalette.accent} inset`,
                color: "#ffffff"
              }
            : undefined
        }
        onClick={() => {
          setErrorMessage(null)
          setIsPickerOpen((currentValue) => {
            const nextValue = !currentValue
            persistDraft({
              isPickerOpen: nextValue,
              isCreateFormOpen,
              newCategoryName
            })
            props.onUiStateChange?.()
            return nextValue
          })
        }}
      >
        {currentLabel}
      </BadgeButton>
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
          <BadgeButton
            data-treem-role="category-create-toggle"
            className="treem-category-create-toggle"
            variant="secondary"
            onClick={() => {
              setErrorMessage(null)
              setIsCreateFormOpen((currentValue) => {
                const nextValue = !currentValue
                persistDraft({
                  isPickerOpen,
                  isCreateFormOpen: nextValue,
                  newCategoryName
                })
                props.onUiStateChange?.()
                return nextValue
              })
            }}
          >
            New
          </BadgeButton>
          {isCreateFormOpen ? (
            <form
              data-treem-role="category-create-form"
              className="treem-category-create-form"
              onSubmit={async (event) => {
                event.preventDefault()
                await handleCreateCategory()
              }}
            >
              <input
                type="text"
                data-treem-role="category-create-input"
                className="treem-category-create-input"
                ref={newCategoryInputRef}
                value={newCategoryName}
                placeholder="New category"
                onChange={(event) => {
                  const nextValue = event.currentTarget.value
                  setNewCategoryName(nextValue)
                  persistDraft({
                    isPickerOpen,
                    isCreateFormOpen,
                    newCategoryName: nextValue
                  })
                  if (errorMessage) setErrorMessage(null)
                }}
              />
            </form>
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

function stopEventPropagation(event: {
  stopPropagation: () => void
}): void {
  event.stopPropagation()
}

function readCategoryControlDraft(messageId: string): CategoryControlDraft {
  return (
    categoryControlDrafts.get(messageId) ?? {
      isPickerOpen: false,
      isCreateFormOpen: false,
      newCategoryName: ""
    }
  )
}

function writeCategoryControlDraft(
  messageId: string,
  draft: CategoryControlDraft
): void {
  categoryControlDrafts.set(messageId, draft)
}

function clearCategoryControlDraft(messageId: string): void {
  categoryControlDrafts.delete(messageId)
}

export function resetCategoryControlDraftsForTests(): void {
  categoryControlDrafts.clear()
}

export function isCategoryControlPinnedOpen(messageId: string): boolean {
  const draft = categoryControlDrafts.get(messageId)
  return draft?.isPickerOpen === true || draft?.isCreateFormOpen === true
}

export function hasCategoryControlDraft(messageId: string): boolean {
  const draft = categoryControlDrafts.get(messageId)
  if (!draft) return false

  return (
    draft.isPickerOpen === true ||
    draft.isCreateFormOpen === true ||
    draft.newCategoryName.trim().length > 0
  )
}

function readCurrentCategory(
  state: LeaderboardState,
  messageId: string
) {
  const assignment = state.messageCategoryAssignments.find(
    (candidate) => candidate.messageId === messageId
  )
  if (!assignment) return null

  return state.categories.find(
    (candidate) => candidate.id === assignment.categoryId
  )
}
