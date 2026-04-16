import {
  UNCATEGORIZED_CATEGORY_ID,
  assignMessageToCategory,
  clearMessageCategoryAssignment,
  createCategoryAndAssign,
  listGuildCategories
} from "../shared/category-state"
import type { LeaderboardState } from "../shared/types"

const MESSAGE_SELECTOR = [
  'li[id^="chat-messages-"]',
  'article[id^="chat-messages-"]',
  '[data-list-item-id^="chat-messages_"]'
].join(",")

interface CategorizationRuntime {
  document: Document
  guildId: string
  loadState: () => Promise<LeaderboardState>
  saveState: (state: LeaderboardState) => Promise<void>
}

export async function enhanceCategorizationControls(
  runtime: CategorizationRuntime
): Promise<void> {
  ensureCategorizationStyles(runtime.document)

  const state = await runtime.loadState()
  const capturedMessageIds = new Set(
    state.messages
      .filter((message) => message.guildId === runtime.guildId)
      .map((message) => message.id)
  )

  runtime.document
    .querySelectorAll<HTMLElement>(MESSAGE_SELECTOR)
    .forEach((messageNode) => {
      enhanceMessageNode({
        runtime,
        state,
        capturedMessageIds,
        messageNode
      })
    })
}

function enhanceMessageNode(input: {
  runtime: CategorizationRuntime
  state: LeaderboardState
  capturedMessageIds: Set<string>
  messageNode: HTMLElement
}): void {
  const messageId = extractMessageId(input.messageNode)
  if (!messageId) return

  const messageKey = `${input.runtime.guildId}:${readChannelId(input.runtime.document.location?.pathname)}:${messageId}`
  if (!input.capturedMessageIds.has(messageKey)) return

  const headerNode =
    input.messageNode.querySelector("time")?.parentElement ?? input.messageNode
  if (
    headerNode.querySelector('[data-treem-role="category-control"]') != null
  ) {
    return
  }

  const control = createControl({
    document: input.runtime.document,
    state: input.state,
    guildId: input.runtime.guildId,
    messageId: messageKey,
    loadState: input.runtime.loadState,
    saveState: input.runtime.saveState
  })

  headerNode.append(control.root)
  bindHoverState(input.messageNode, control.root)
}

function createControl(input: {
  document: Document
  state: LeaderboardState
  guildId: string
  messageId: string
  loadState: () => Promise<LeaderboardState>
  saveState: (state: LeaderboardState) => Promise<void>
}): {
  root: HTMLElement
} {
  const root = input.document.createElement("div")
  root.dataset.treemRole = "category-control"
  root.className = "treem-category-control"
  root.hidden = true

  const toggle = input.document.createElement("button")
  toggle.type = "button"
  toggle.dataset.treemRole = "category-toggle"
  toggle.className = "treem-category-toggle"
  toggle.textContent = currentCategoryLabel(input.state, input.messageId)

  const form = input.document.createElement("form")
  form.dataset.treemRole = "category-form"
  form.className = "treem-category-form"
  form.hidden = true

  const categorySelect = input.document.createElement("select")
  categorySelect.name = "categoryId"
  categorySelect.dataset.treemRole = "category-select"
  categorySelect.className = "treem-category-select"

  const inputNode = input.document.createElement("input")
  inputNode.type = "text"
  inputNode.name = "categoryName"
  inputNode.placeholder = "New category"
  inputNode.dataset.treemRole = "category-name-input"
  inputNode.className = "treem-category-name-input"
  inputNode.required = true

  const submit = input.document.createElement("button")
  submit.type = "submit"
  submit.textContent = "Save"

  populateCategoryOptions({
    select: categorySelect,
    categories: listGuildCategories(input.state, input.guildId)
  })

  form.append(categorySelect, inputNode, submit)
  root.append(toggle, form)

  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden
    if (!form.hidden) {
      categorySelect.value = ""
      inputNode.focus()
    }
  })

  categorySelect.addEventListener("change", async () => {
    if (!categorySelect.value) return

    const nextState = await applyCategorySelection({
      state: await input.loadState(),
      guildId: input.guildId,
      messageId: input.messageId,
      categoryId: categorySelect.value
    })

    await input.saveState(nextState)
    updateFormState({
      state: nextState,
      guildId: input.guildId,
      messageId: input.messageId,
      toggle,
      categorySelect,
      inputNode,
      form
    })
  })

  form.addEventListener("submit", async (event) => {
    event.preventDefault()

    const nextState = createCategoryAndAssign({
      state: await input.loadState(),
      guildId: input.guildId,
      messageId: input.messageId,
      categoryName: inputNode.value
    }).state

    await input.saveState(nextState)
    updateFormState({
      state: nextState,
      guildId: input.guildId,
      messageId: input.messageId,
      toggle,
      categorySelect,
      inputNode,
      form
    })
  })

  return { root }
}

function currentCategoryLabel(
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

function bindHoverState(messageNode: HTMLElement, control: HTMLElement): void {
  const show = () => {
    control.hidden = false
  }
  const hide = () => {
    if (control.contains(messageNode.ownerDocument.activeElement)) return
    control.hidden = true
  }

  messageNode.addEventListener("mouseenter", show)
  messageNode.addEventListener("mouseleave", hide)
  control.addEventListener("focusin", show)
  control.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (control.contains(messageNode.ownerDocument.activeElement)) return
      control.hidden = true
    }, 0)
  })
}

function extractMessageId(node: HTMLElement): string | null {
  if (node.id.startsWith("chat-messages-")) {
    return node.id.replace("chat-messages-", "")
  }

  const dataListItemId = node.dataset.listItemId
  if (!dataListItemId) return null

  const parts = dataListItemId.split("_")
  return parts.length > 0 ? parts[parts.length - 1] : null
}

function readChannelId(pathname: string | undefined): string {
  const match = pathname?.match(/^\/channels\/[^/]+\/([^/]+)/)
  return match?.[1] ?? "unknown-channel"
}

function ensureCategorizationStyles(document: Document): void {
  if (document.getElementById("treem-category-styles")) return

  const style = document.createElement("style")
  style.id = "treem-category-styles"
  style.textContent = `
    .treem-category-control {
      display: inline-flex;
      gap: 6px;
      margin-inline-start: 8px;
      align-items: center;
    }
    .treem-category-toggle,
    .treem-category-form button {
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(88, 101, 242, 0.16);
      color: inherit;
      border-radius: 999px;
      padding: 2px 8px;
      font: inherit;
      cursor: pointer;
    }
    .treem-category-form {
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .treem-category-select,
    .treem-category-name-input {
      min-width: 120px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(0, 0, 0, 0.2);
      color: inherit;
      padding: 2px 10px;
      font: inherit;
    }
  `

  document.head.append(style)
}

async function applyCategorySelection(input: {
  state: LeaderboardState
  guildId: string
  messageId: string
  categoryId: string
}): Promise<LeaderboardState> {
  if (input.categoryId === UNCATEGORIZED_CATEGORY_ID) {
    return clearMessageCategoryAssignment({
      state: input.state,
      guildId: input.guildId,
      messageId: input.messageId
    }).state
  }

  return assignMessageToCategory({
    state: input.state,
    guildId: input.guildId,
    messageId: input.messageId,
    categoryId: input.categoryId
  }).state
}

function populateCategoryOptions(input: {
  select: HTMLSelectElement
  categories: ReturnType<typeof listGuildCategories>
}): void {
  input.select.innerHTML = [
    '<option value="">Choose category</option>',
    ...input.categories.map(
      (category) =>
        `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`
    ),
    `<option value="${UNCATEGORIZED_CATEGORY_ID}">Uncategorized</option>`
  ].join("")
}

function updateFormState(input: {
  state: LeaderboardState
  guildId: string
  messageId: string
  toggle: HTMLButtonElement
  categorySelect: HTMLSelectElement
  inputNode: HTMLInputElement
  form: HTMLFormElement
}): void {
  input.toggle.textContent = currentCategoryLabel(input.state, input.messageId)
  populateCategoryOptions({
    select: input.categorySelect,
    categories: listGuildCategories(input.state, input.guildId)
  })
  input.categorySelect.value = ""
  input.inputNode.value = ""
  input.form.hidden = true
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
