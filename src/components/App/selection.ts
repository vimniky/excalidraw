import {
  getElementWithTransformHandleType,
  getTransformHandleTypeFromCoords,
  getCommonBounds,
  getCursorForResizingElement,
  getResizeOffsetXY,
  getResizeArrowDirection,
} from "../../element";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { isLinearElement } from "../../element/typeChecks";
import { ExcalidrawElement } from "../../element/types";
import {
  editGroupForSelectedElement,
  isElementInGroup,
  selectGroupsForSelectedElements,
} from "../../groups";
import { KEYS } from "../../keys";
import { getSelectedElements } from "../../scene";
import { tupleToCoors } from "../../utils";
import App, { PointerDownState } from "../App";

export const handleSelectionOnPointerDown = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
  pointerDownState: PointerDownState,
): boolean => {
  if ($app.state.elementType === "selection") {
    const elements = App.scene.getElements();
    const selectedElements = getSelectedElements(elements, $app.state);
    if (selectedElements.length === 1 && !$app.state.editingLinearElement) {
      const elementWithTransformHandleType = getElementWithTransformHandleType(
        elements,
        $app.state,
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        $app.state.zoom,
        event.pointerType,
      );
      if (elementWithTransformHandleType != null) {
        $app.setState({
          resizingElement: elementWithTransformHandleType.element,
        });
        pointerDownState.resize.handleType =
          elementWithTransformHandleType.transformHandleType;
      }
    } else if (selectedElements.length > 1) {
      pointerDownState.resize.handleType = getTransformHandleTypeFromCoords(
        getCommonBounds(selectedElements),
        pointerDownState.origin.x,
        pointerDownState.origin.y,
        $app.state.zoom,
        event.pointerType,
      );
    }
    if (pointerDownState.resize.handleType) {
      document.documentElement.style.cursor = getCursorForResizingElement({
        transformHandleType: pointerDownState.resize.handleType,
      });
      pointerDownState.resize.isResizing = true;
      pointerDownState.resize.offset = tupleToCoors(
        getResizeOffsetXY(
          pointerDownState.resize.handleType,
          selectedElements,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        ),
      );
      if (
        selectedElements.length === 1 &&
        isLinearElement(selectedElements[0]) &&
        selectedElements[0].points.length === 2
      ) {
        pointerDownState.resize.arrowDirection = getResizeArrowDirection(
          pointerDownState.resize.handleType,
          selectedElements[0],
        );
      }
    } else {
      if ($app.state.editingLinearElement) {
        const ret = LinearElementEditor.handlePointerDown(
          event,
          $app.state,
          (appState: any) => $app.setState(appState),
          App.history,
          pointerDownState.origin,
        );
        if (ret.hitElement) {
          pointerDownState.hit.element = ret.hitElement;
        }
        if (ret.didAddPoint) {
          return true;
        }
      }

      // hitElement may already be set above, so check first
      pointerDownState.hit.element =
        pointerDownState.hit.element ??
        $app.getElementAtPosition(
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        );

      // For overlapped elements one position may hit
      // multiple elements
      pointerDownState.hit.allHitElements = $app.getElementsAtPosition(
        pointerDownState.origin.x,
        pointerDownState.origin.y,
      );

      const hitElement = pointerDownState.hit.element;
      const someHitElementIsSelected = pointerDownState.hit.allHitElements.some(
        (element) => $app.isASelectedElement(element),
      );
      if (
        (hitElement === null || !someHitElementIsSelected) &&
        !event.shiftKey &&
        !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
      ) {
        $app.clearSelection(hitElement);
      }

      // If we click on something
      if (hitElement != null) {
        // on CMD/CTRL, drill down to hit element regardless of groups etc.
        if (event[KEYS.CTRL_OR_CMD]) {
          $app.setState((prevState) => ({
            ...editGroupForSelectedElement(prevState, hitElement),
            previousSelectedElementIds: $app.state.selectedElementIds,
          }));
          // mark as not completely handled so as to allow dragging etc.
          return false;
        }

        // deselect if item is selected
        // if shift is not holding, it will always return true
        // otherwise, it will trigger selection based on current
        // state of the box
        if (!$app.state.selectedElementIds[hitElement.id]) {
          // if we are currently editing a group, treat all selections outside of the group
          // as exiting editing mode.
          if (
            $app.state.editingGroupId &&
            !isElementInGroup(hitElement, $app.state.editingGroupId)
          ) {
            $app.setState({
              selectedElementIds: {},
              selectedGroupIds: {},
              editingGroupId: null,
            });
            // return true;
          }

          // Add hit element to selection. At this point if we're not holding
          // SHIFT the previously selected element(s) were deselected above
          // (make sure you use setState updater to use latest state)
          if (
            !someHitElementIsSelected &&
            !pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
          ) {
            $app.setState((prevState) => {
              return selectGroupsForSelectedElements(
                {
                  ...prevState,
                  selectedElementIds: {
                    ...prevState.selectedElementIds,
                    [hitElement.id]: true,
                  },
                },
                App.scene.getElements(),
              );
            });
            pointerDownState.hit.wasAddedToSelection = true;
          }
        }
      }

      $app.setState({
        previousSelectedElementIds: $app.state.selectedElementIds,
      });
    }
  }
  return false;
};

export const clearSelection = ($app: App) => (
  hitElement: ExcalidrawElement | null,
): void => {
  $app.setState((prevState) => ({
    selectedElementIds: {},
    selectedGroupIds: {},
    // Continue editing the same group if the user selected a different
    // element from it
    previousSelectedElementIds: $app.state.selectedElementIds,
    editingGroupId:
      prevState.editingGroupId &&
      hitElement != null &&
      isElementInGroup(hitElement, prevState.editingGroupId)
        ? prevState.editingGroupId
        : null,
  }));
};

export const clearSelectionIfNotUsingSelection = ($app: App) => (): void => {
  if ($app.state.elementType !== "selection") {
    $app.setState({
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    });
  }
};
