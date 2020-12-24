import { trackEvent, EVENT_DIALOG, EVENT_SHAPE } from "../../analytics";
import {
  ELEMENT_TRANSLATE_AMOUNT,
  ELEMENT_SHIFT_TRANSLATE_AMOUNT,
  CURSOR_TYPE,
} from "../../constants";
import {
  isBindingEnabled,
  bindOrUnbindSelectedElements,
  unbindLinearElements,
  updateBoundElements,
} from "../../element/binding";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { mutateElement } from "../../element/mutateElement";
import { isLinearElement } from "../../element/typeChecks";
import { KEYS, isArrowKey, CODES } from "../../keys";
import { getSelectedElements } from "../../scene";
import { findShapeByKey } from "../../shapes";
import {
  withBatchedUpdates,
  resetCursor,
  setCursorForShape,
  isInputLike,
  isWritableElement,
} from "../../utils";
import App, { PointerDownState } from "../App";

export const onKeydown = ($app: App) =>
  withBatchedUpdates((event: KeyboardEvent) => {
    // normalize `event.key` when CapsLock is pressed #2372
    if (
      "Proxy" in window &&
      ((!event.shiftKey && /^[A-Z]$/.test(event.key)) ||
        (event.shiftKey && /^[a-z]$/.test(event.key)))
    ) {
      event = new Proxy(event, {
        get(ev: any, prop) {
          const value = ev[prop];
          if (typeof value === "function") {
            // fix for Proxies hijacking `this`
            return value.bind(ev);
          }
          return prop === "key"
            ? // CapsLock inverts capitalization based on ShiftKey, so invert
              // it back
              event.shiftKey
              ? ev.key.toUpperCase()
              : ev.key.toLowerCase()
            : value;
        },
      });
    }

    if (
      (isWritableElement(event.target) && event.key !== KEYS.ESCAPE) ||
      // case: using arrows to move between buttons
      (isArrowKey(event.key) && isInputLike(event.target))
    ) {
      return;
    }

    if (event.key === KEYS.QUESTION_MARK) {
      $app.setState({
        showShortcutsDialog: true,
      });
    }

    if (!event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.Z) {
      $app.toggleZenMode();
    }

    if (event[KEYS.CTRL_OR_CMD] && event.code === CODES.QUOTE) {
      $app.toggleGridMode();
    }
    if (event[KEYS.CTRL_OR_CMD]) {
      $app.setState({ isBindingEnabled: false });
    }

    if (event.code === CODES.C && event.altKey && event.shiftKey) {
      $app.copyToClipboardAsPng();
      event.preventDefault();
      return;
    }

    if (App.actionManager.handleKeyDown(event)) {
      return;
    }

    if (event.code === CODES.NINE) {
      if (!$app.state.isLibraryOpen) {
        trackEvent(EVENT_DIALOG, "library");
      }
      $app.setState({ isLibraryOpen: !$app.state.isLibraryOpen });
    }

    if (isArrowKey(event.key)) {
      const step =
        ($app.state.gridSize &&
          (event.shiftKey ? ELEMENT_TRANSLATE_AMOUNT : $app.state.gridSize)) ||
        (event.shiftKey
          ? ELEMENT_SHIFT_TRANSLATE_AMOUNT
          : ELEMENT_TRANSLATE_AMOUNT);

      const selectedElements = App.scene
        .getElements()
        .filter((element) => $app.state.selectedElementIds[element.id]);

      let offsetX = 0;
      let offsetY = 0;

      if (event.key === KEYS.ARROW_LEFT) {
        offsetX = -step;
      } else if (event.key === KEYS.ARROW_RIGHT) {
        offsetX = step;
      } else if (event.key === KEYS.ARROW_UP) {
        offsetY = -step;
      } else if (event.key === KEYS.ARROW_DOWN) {
        offsetY = step;
      }

      selectedElements.forEach((element) => {
        mutateElement(element, {
          x: element.x + offsetX,
          y: element.y + offsetY,
        });

        updateBoundElements(element, {
          simultaneouslyUpdated: selectedElements,
        });
      });

      $app.maybeSuggestBindingForAll(selectedElements);

      event.preventDefault();
    } else if (event.key === KEYS.ENTER) {
      const selectedElements = getSelectedElements(
        App.scene.getElements(),
        $app.state,
      );

      if (
        selectedElements.length === 1 &&
        isLinearElement(selectedElements[0])
      ) {
        if (
          !$app.state.editingLinearElement ||
          $app.state.editingLinearElement.elementId !== selectedElements[0].id
        ) {
          App.history.resumeRecording();
          $app.setState({
            editingLinearElement: new LinearElementEditor(
              selectedElements[0],
              App.scene,
            ),
          });
        }
      } else if (
        selectedElements.length === 1 &&
        !isLinearElement(selectedElements[0])
      ) {
        const selectedElement = selectedElements[0];
        $app.startTextEditing({
          sceneX: selectedElement.x + selectedElement.width / 2,
          sceneY: selectedElement.y + selectedElement.height / 2,
        });
        event.preventDefault();
        return;
      }
    } else if (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      $app.state.draggingElement === null
    ) {
      const shape = findShapeByKey(event.key);
      if (shape) {
        trackEvent(EVENT_SHAPE, shape, "shortcut");
        $app.selectShapeTool(shape);
      } else if (event.key === KEYS.Q) {
        $app.toggleLock();
      }
    }
    if (event.key === KEYS.SPACE && App.gesture.pointers.size === 0) {
      App.isHoldingSpace = true;
      document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
    }
  });

export const onKeyUp = ($app: App) =>
  withBatchedUpdates((event: KeyboardEvent) => {
    if (event.key === KEYS.SPACE) {
      if ($app.state.elementType === "selection") {
        resetCursor();
      } else {
        setCursorForShape($app.state.elementType);
        $app.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });
      }
      App.isHoldingSpace = false;
    }
    if (!event[KEYS.CTRL_OR_CMD] && !$app.state.isBindingEnabled) {
      $app.setState({ isBindingEnabled: true });
    }
    if (isArrowKey(event.key)) {
      const selectedElements = getSelectedElements(
        App.scene.getElements(),
        $app.state,
      );
      isBindingEnabled($app.state)
        ? bindOrUnbindSelectedElements(selectedElements)
        : unbindLinearElements(selectedElements);
      $app.setState({ suggestedBindings: [] });
    }
  });

export const onKeyDownFromPointerDownHandler = ($app: App) => (
  pointerDownState: PointerDownState,
): ((event: KeyboardEvent) => void) => {
  return withBatchedUpdates((event: KeyboardEvent) => {
    if ($app.maybeHandleResize(pointerDownState, event)) {
      return;
    }
    $app.maybeDragNewGenericElement(pointerDownState, event);
  });
};
export const onKeyUpFromPointerDownHandler = ($app: App) => (
  pointerDownState: PointerDownState,
): ((event: KeyboardEvent) => void) => {
  return withBatchedUpdates((event: KeyboardEvent) => {
    // Prevents focus from escaping excalidraw tab
    event.key === KEYS.ALT && event.preventDefault();
    if ($app.maybeHandleResize(pointerDownState, event)) {
      return;
    }
    $app.maybeDragNewGenericElement(pointerDownState, event);
  });
};
