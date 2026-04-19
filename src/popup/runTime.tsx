
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import "./lib/styles.css"
import type { PopupRuntime,  } from "./types"
import { AtomRegistryProvider } from "./lib/atom-registry-provider"
import {
runPopupStateEffect,
  ensurePopupMountNode,
runPopupStateSyncEffect
} from "./lib/helpers"
import { Effect } from "effect"
import { PopupStateService } from "./services/popup-state-service"
import { PopupApp } from "./App"
export let popupRuntime: PopupRuntime = createBrowserRuntime()
export let popupRoot: Root | null = null
export let popupMountNode: HTMLElement | null = null
export let renderKey = 0

export async function bootstrapPopup(
  runtimeOverrides: Partial<PopupRuntime> = {}
): Promise<void> {
  popupRuntime = {
    ...createBrowserRuntime(),
    ...runtimeOverrides
  }

  const mountNode = ensurePopupMountNode(popupRuntime.document)
  const initialModel = await popupRuntime.loadInitialPopupModel()
  const initialState = initialModel.state
  const initialSelection = initialModel.selection

  if (!popupRoot || popupMountNode !== mountNode) {
    popupRoot = createRoot(mountNode)
    popupMountNode = mountNode
  }

  renderKey += 1

  flushSync(() => {
    popupRoot?.render(
      <AtomRegistryProvider>
      <PopupApp
        key={renderKey}
        runtime={popupRuntime}
        initialState={initialState}
        initialSelection={initialSelection}
        />
      </AtomRegistryProvider>
    )
  })
}

function createBrowserRuntime(): PopupRuntime {
  return {
    document,
    loadInitialPopupModel: () =>
      runPopupStateEffect(
        Effect.gen(function* () {
          const popupState = yield* PopupStateService
          return yield* popupState.loadInitialPopupModel()
        })
      ),
    refreshPopupModel: (previousSelection) =>
      runPopupStateEffect(
        Effect.gen(function* () {
          const popupState = yield* PopupStateService
          return yield* popupState.refreshPopupModel(previousSelection)
        })
      ),
    saveSelection: (selection) =>
      runPopupStateEffect(
        Effect.gen(function* () {
          const popupState = yield* PopupStateService
          return yield* popupState.saveSelection(selection)
        })
      ),
    subscribeToLeaderboardStateChanges: (listener) =>
      runPopupStateSyncEffect(
        Effect.gen(function* () {
          const popupState = yield* PopupStateService
          return yield* popupState.subscribeToLeaderboardStateChanges(listener)
        })
      )
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void bootstrapPopup()
})
