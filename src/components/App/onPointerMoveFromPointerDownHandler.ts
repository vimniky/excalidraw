import { simplify } from "points-on-curve";
import { Point } from "roughjs/bin/geometry";
import { DRAGGING_THRESHOLD } from "../../constants";
import {
  getDragOffsetXY,
  dragSelectedElements,
  duplicateElement,
  getPerfectElementSize,
} from "../../element";
import { fixBindingsAfterDuplication } from "../../element/binding";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { mutateElement } from "../../element/mutateElement";
import { isLinearElement, isBindingElement } from "../../element/typeChecks";
import { selectGroupsForSelectedElements } from "../../groups";
import { getRotateWithDiscreteAngleKey } from "../../keys";
import { getGridPoint, distance2d } from "../../math";
import {
  getSelectedElements,
  isSomeElementSelected,
  getElementsWithinSelection,
} from "../../scene";
import {
  withBatchedUpdates,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "../../utils";
import App, { PointerDownState } from "../App";

export const onPointerMoveFromPointerDownHandler = ($app: App) => (
  pointerDownState: PointerDownState,
): ((event: PointerEvent) => void) => {
  return withBatchedUpdates((event: PointerEvent) => {
    // We need to initialize dragOffsetXY only after we've updated
    // `state.selectedElementIds` on pointerDown. Doing it here in pointerMove
    // event handler should hopefully ensure we're already working with
    // the updated state.
    if (pointerDownState.drag.offset === null) {
      pointerDownState.drag.offset = tupleToCoors(
        getDragOffsetXY(
          getSelectedElements(App.scene.getElements(), $app.state),
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        ),
      );
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if ($app.handlePointerMoveOverScrollbars(event, pointerDownState)) {
      return;
    }

    const pointerCoords = viewportCoordsToSceneCoords(event, $app.state);
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      $app.state.gridSize,
    );

    // for arrows/lines, don't start dragging until a given threshold
    // to ensure we don't create a 2-point arrow by mistake when
    // user clicks mouse in a way that it moves a tiny bit (thus
    // triggering pointermove)
    if (
      !pointerDownState.drag.hasOccurred &&
      ($app.state.elementType === "arrow" || $app.state.elementType === "line")
    ) {
      if (
        distance2d(
          pointerCoords.x,
          pointerCoords.y,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        ) < DRAGGING_THRESHOLD
      ) {
        return;
      }
    }

    if (pointerDownState.resize.isResizing) {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      if ($app.maybeHandleResize(pointerDownState, event)) {
        return true;
      }
    }

    if ($app.state.editingLinearElement) {
      const didDrag = LinearElementEditor.handlePointDragging(
        $app.state,
        (appState: any) => $app.setState(appState),
        pointerCoords.x,
        pointerCoords.y,
        (element, startOrEnd) => {
          $app.maybeSuggestBindingForLinearElementAtCursor(
            element,
            startOrEnd,
            pointerCoords,
          );
        },
      );

      if (didDrag) {
        pointerDownState.lastCoords.x = pointerCoords.x;
        pointerDownState.lastCoords.y = pointerCoords.y;
        return;
      }
    }

    const hasHitASelectedElement = pointerDownState.hit.allHitElements.some(
      (element) => $app.isASelectedElement(element),
    );
    if (
      hasHitASelectedElement ||
      pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements
    ) {
      // Marking that click was used for dragging to check
      // if elements should be deselected on pointerup
      pointerDownState.drag.hasOccurred = true;
      const selectedElements = getSelectedElements(
        App.scene.getElements(),
        $app.state,
      );
      if (selectedElements.length > 0) {
        const [dragX, dragY] = getGridPoint(
          pointerCoords.x - pointerDownState.drag.offset.x,
          pointerCoords.y - pointerDownState.drag.offset.y,
          $app.state.gridSize,
        );

        const [dragDistanceX, dragDistanceY] = [
          Math.abs(pointerCoords.x - pointerDownState.origin.x),
          Math.abs(pointerCoords.y - pointerDownState.origin.y),
        ];

        // We only drag in one direction if shift is pressed
        const lockDirection = event.shiftKey;

        dragSelectedElements(
          pointerDownState,
          selectedElements,
          dragX,
          dragY,
          App.scene,
          lockDirection,
          dragDistanceX,
          dragDistanceY,
        );
        $app.maybeSuggestBindingForAll(selectedElements);

        // We duplicate the selected element if alt is pressed on pointer move
        if (event.altKey && !pointerDownState.hit.hasBeenDuplicated) {
          // Move the currently selected elements to the top of the z index stack, and
          // put the duplicates where the selected elements used to be.
          // (the origin point where the dragging started)

          pointerDownState.hit.hasBeenDuplicated = true;

          const nextElements = [];
          const elementsToAppend = [];
          const groupIdMap = new Map();
          const oldIdToDuplicatedId = new Map();
          const hitElement = pointerDownState.hit.element;
          for (const element of App.scene.getElementsIncludingDeleted()) {
            if (
              $app.state.selectedElementIds[element.id] ||
              // case: the state.selectedElementIds might not have been
              // updated yet by the time $app mousemove event is fired
              (element.id === hitElement?.id &&
                pointerDownState.hit.wasAddedToSelection)
            ) {
              const duplicatedElement = duplicateElement(
                $app.state.editingGroupId,
                groupIdMap,
                element,
              );
              const [originDragX, originDragY] = getGridPoint(
                pointerDownState.origin.x - pointerDownState.drag.offset.x,
                pointerDownState.origin.y - pointerDownState.drag.offset.y,
                $app.state.gridSize,
              );
              mutateElement(duplicatedElement, {
                x: duplicatedElement.x + (originDragX - dragX),
                y: duplicatedElement.y + (originDragY - dragY),
              });
              nextElements.push(duplicatedElement);
              elementsToAppend.push(element);
              oldIdToDuplicatedId.set(element.id, duplicatedElement.id);
            } else {
              nextElements.push(element);
            }
          }
          const nextSceneElements = [...nextElements, ...elementsToAppend];
          fixBindingsAfterDuplication(
            nextSceneElements,
            elementsToAppend,
            oldIdToDuplicatedId,
            "duplicatesServeAsOld",
          );
          App.scene.replaceAllElements(nextSceneElements);
        }
        return;
      }
    }

    // It is very important to read $app.state within each move event,
    // otherwise we would read a stale one!
    const draggingElement = $app.state.draggingElement;
    if (!draggingElement) {
      return;
    }

    if (isLinearElement(draggingElement)) {
      pointerDownState.drag.hasOccurred = true;
      const points = draggingElement.points;
      let dx: number;
      let dy: number;
      if (draggingElement.type === "draw") {
        dx = pointerCoords.x - draggingElement.x;
        dy = pointerCoords.y - draggingElement.y;
      } else {
        dx = gridX - draggingElement.x;
        dy = gridY - draggingElement.y;
      }

      if (getRotateWithDiscreteAngleKey(event) && points.length === 2) {
        ({ width: dx, height: dy } = getPerfectElementSize(
          $app.state.elementType,
          dx,
          dy,
        ));
      }

      if (points.length === 1) {
        mutateElement(draggingElement, { points: [...points, [dx, dy]] });
      } else if (points.length > 1) {
        if (draggingElement.type === "draw") {
          mutateElement(draggingElement, {
            points: simplify(
              [...(points as Point[]), [dx, dy]],
              0.7 / $app.state.zoom.value,
            ),
          });
        } else {
          mutateElement(draggingElement, {
            points: [...points.slice(0, -1), [dx, dy]],
          });
        }
      }
      if (isBindingElement(draggingElement)) {
        // When creating a linear element by dragging
        $app.maybeSuggestBindingForLinearElementAtCursor(
          draggingElement,
          "end",
          pointerCoords,
          $app.state.startBoundElement,
        );
      }
    } else {
      pointerDownState.lastCoords.x = pointerCoords.x;
      pointerDownState.lastCoords.y = pointerCoords.y;
      $app.maybeDragNewGenericElement(pointerDownState, event);
    }

    if ($app.state.elementType === "selection") {
      const elements = App.scene.getElements();
      if (!event.shiftKey && isSomeElementSelected(elements, $app.state)) {
        $app.setState({
          selectedElementIds: {},
          selectedGroupIds: {},
          editingGroupId: null,
        });
      }
      const elementsWithinSelection = getElementsWithinSelection(
        elements,
        draggingElement,
      );
      $app.setState((prevState) =>
        selectGroupsForSelectedElements(
          {
            ...prevState,
            selectedElementIds: {
              ...prevState.selectedElementIds,
              ...elementsWithinSelection.reduce((map, element) => {
                map[element.id] = true;
                return map;
              }, {} as any),
            },
          },
          App.scene.getElements(),
        ),
      );
    }
  });
};
