import { actionFinalize } from "../../actions";
import { EVENT } from "../../constants";
import {
  isTextElement,
  isInvisiblySmallElement,
  getNormalizedDimensions,
  isHittingElementBoundingBoxWithoutHittingElement,
} from "../../element";
import {
  isBindingEnabled,
  maybeBindLinearElement,
  bindOrUnbindSelectedElements,
  unbindLinearElements,
} from "../../element/binding";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { mutateElement } from "../../element/mutateElement";
import { isLinearElement, isBindingElement } from "../../element/typeChecks";
import {
  isSelectedViaGroup,
  getElementsInGroup,
  selectGroupsForSelectedElements,
} from "../../groups";
import { isSomeElementSelected, getSelectedElements } from "../../scene";
import {
  withBatchedUpdates,
  viewportCoordsToSceneCoords,
  resetCursor,
} from "../../utils";
import App, { PointerDownState } from "../App";

export const onPointerUpFromPointerDownHandler = ($app: App) => (
  pointerDownState: PointerDownState,
): ((event: PointerEvent) => void) => {
  return withBatchedUpdates((childEvent: PointerEvent) => {
    const {
      draggingElement,
      resizingElement,
      multiElement,
      elementType,
      elementLocked,
      isResizing,
      isRotating,
    } = $app.state;

    $app.setState({
      isResizing: false,
      isRotating: false,
      resizingElement: null,
      selectionElement: null,
      cursorButton: "up",
      // text elements are reset on finalize, and resetting on pointerup
      // may cause issues with double taps
      editingElement:
        multiElement || isTextElement($app.state.editingElement)
          ? $app.state.editingElement
          : null,
    });

    $app.savePointer(childEvent.clientX, childEvent.clientY, "up");

    // Handle end of dragging a point of a linear element, might close a loop
    // and sets binding element
    if ($app.state.editingLinearElement) {
      const editingLinearElement = LinearElementEditor.handlePointerUp(
        childEvent,
        $app.state.editingLinearElement,
        $app.state,
      );
      if (editingLinearElement !== $app.state.editingLinearElement) {
        $app.setState({
          editingLinearElement,
          suggestedBindings: [],
        });
      }
    }

    App.lastPointerUp = null;

    window.removeEventListener(
      EVENT.POINTER_MOVE,
      pointerDownState.eventListeners.onMove!,
    );
    window.removeEventListener(
      EVENT.POINTER_UP,
      pointerDownState.eventListeners.onUp!,
    );
    window.removeEventListener(
      EVENT.KEYDOWN,
      pointerDownState.eventListeners.onKeyDown!,
    );
    window.removeEventListener(
      EVENT.KEYUP,
      pointerDownState.eventListeners.onKeyUp!,
    );

    if (draggingElement?.type === "draw") {
      App.actionManager.executeAction(actionFinalize);
      return;
    }

    if (isLinearElement(draggingElement)) {
      if (draggingElement!.points.length > 1) {
        App.history.resumeRecording();
      }
      const pointerCoords = viewportCoordsToSceneCoords(childEvent, $app.state);

      if (
        !pointerDownState.drag.hasOccurred &&
        draggingElement &&
        !multiElement
      ) {
        mutateElement(draggingElement, {
          points: [
            ...draggingElement.points,
            [
              pointerCoords.x - draggingElement.x,
              pointerCoords.y - draggingElement.y,
            ],
          ],
        });
        $app.setState({
          multiElement: draggingElement,
          editingElement: $app.state.draggingElement,
        });
      } else if (pointerDownState.drag.hasOccurred && !multiElement) {
        if (isBindingEnabled($app.state) && isBindingElement(draggingElement)) {
          maybeBindLinearElement(
            draggingElement,
            $app.state,
            App.scene,
            pointerCoords,
          );
        }
        $app.setState({ suggestedBindings: [], startBoundElement: null });
        if (!elementLocked) {
          resetCursor();
          $app.setState((prevState) => ({
            draggingElement: null,
            elementType: "selection",
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [$app.state.draggingElement!.id]: true,
            },
          }));
        } else {
          $app.setState((prevState) => ({
            draggingElement: null,
            selectedElementIds: {
              ...prevState.selectedElementIds,
              [$app.state.draggingElement!.id]: true,
            },
          }));
        }
      }
      return;
    }

    if (
      elementType !== "selection" &&
      draggingElement &&
      isInvisiblySmallElement(draggingElement)
    ) {
      // remove invisible element which was added in onPointerDown
      App.scene.replaceAllElements(
        App.scene.getElementsIncludingDeleted().slice(0, -1),
      );
      $app.setState({
        draggingElement: null,
      });
      return;
    }

    if (draggingElement) {
      mutateElement(draggingElement, getNormalizedDimensions(draggingElement));
    }

    if (resizingElement) {
      App.history.resumeRecording();
    }

    if (resizingElement && isInvisiblySmallElement(resizingElement)) {
      App.scene.replaceAllElements(
        App.scene
          .getElementsIncludingDeleted()
          .filter((el) => el.id !== resizingElement.id),
      );
    }

    // Code below handles selection when element(s) weren't
    // drag or added to selection on pointer down phase.
    const hitElement = pointerDownState.hit.element;
    if (
      hitElement &&
      !pointerDownState.drag.hasOccurred &&
      !pointerDownState.hit.wasAddedToSelection
    ) {
      if (childEvent.shiftKey) {
        if ($app.state.selectedElementIds[hitElement.id]) {
          if (isSelectedViaGroup($app.state, hitElement)) {
            // We want to unselect all groups hitElement is part of
            // as well as all elements that are part of the groups
            // hitElement is part of
            const idsOfSelectedElementsThatAreInGroups = hitElement.groupIds
              .flatMap((groupId) =>
                getElementsInGroup(App.scene.getElements(), groupId),
              )
              .map((element) => ({ [element.id]: false }))
              .reduce((prevId, acc) => ({ ...prevId, ...acc }), {});

            $app.setState((_prevState) => ({
              selectedGroupIds: {
                ..._prevState.selectedElementIds,
                ...hitElement.groupIds
                  .map((gId) => ({ [gId]: false }))
                  .reduce((prev, acc) => ({ ...prev, ...acc }), {}),
              },
              selectedElementIds: {
                ..._prevState.selectedElementIds,
                ...idsOfSelectedElementsThatAreInGroups,
              },
            }));
          } else {
            // remove element from selection while
            // keeping prev elements selected
            $app.setState((prevState) => ({
              selectedElementIds: {
                ...prevState.selectedElementIds,
                [hitElement!.id]: false,
              },
            }));
          }
        } else {
          // add element to selection while
          // keeping prev elements selected
          $app.setState((_prevState) => ({
            selectedElementIds: {
              ..._prevState.selectedElementIds,
              [hitElement!.id]: true,
            },
          }));
        }
      } else {
        $app.setState((prevState) => ({
          ...selectGroupsForSelectedElements(
            {
              ...prevState,
              selectedElementIds: { [hitElement.id]: true },
            },
            App.scene.getElements(),
          ),
        }));
      }
    }

    if (
      !$app.state.editingLinearElement &&
      !pointerDownState.drag.hasOccurred &&
      !$app.state.isResizing &&
      ((hitElement &&
        isHittingElementBoundingBoxWithoutHittingElement(
          hitElement,
          $app.state,
          pointerDownState.origin.x,
          pointerDownState.origin.y,
        )) ||
        (!hitElement &&
          pointerDownState.hit.hasHitCommonBoundingBoxOfSelectedElements))
    ) {
      // Deselect selected elements
      $app.setState({
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      });

      return;
    }

    if (!elementLocked && draggingElement) {
      $app.setState((prevState) => ({
        selectedElementIds: {
          ...prevState.selectedElementIds,
          [draggingElement.id]: true,
        },
      }));
    }

    if (
      elementType !== "selection" ||
      isSomeElementSelected(App.scene.getElements(), $app.state)
    ) {
      App.history.resumeRecording();
    }

    if (pointerDownState.drag.hasOccurred || isResizing || isRotating) {
      (isBindingEnabled($app.state)
        ? bindOrUnbindSelectedElements
        : unbindLinearElements)(
        getSelectedElements(App.scene.getElements(), $app.state),
      );
    }

    if (!elementLocked) {
      resetCursor();
      $app.setState({
        draggingElement: null,
        suggestedBindings: [],
        elementType: "selection",
      });
    } else {
      $app.setState({
        draggingElement: null,
        suggestedBindings: [],
      });
    }
  });
};
