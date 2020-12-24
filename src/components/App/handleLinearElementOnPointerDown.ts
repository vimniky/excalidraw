import { actionFinalize } from "../../actions";
import { LINE_CONFIRM_THRESHOLD, CURSOR_TYPE } from "../../constants";
import { newLinearElement } from "../../element";
import { getHoveredElementForBinding } from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import { ExcalidrawLinearElement } from "../../element/types";
import { isPathALoop, distance2d, getGridPoint } from "../../math";
import App, { PointerDownState } from "../App";

export const handleLinearElementOnPointerDown = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
  elementType: ExcalidrawLinearElement["type"],
  pointerDownState: PointerDownState,
): void => {
  if ($app.state.multiElement) {
    const { multiElement } = $app.state;

    // finalize if completing a loop
    if (multiElement.type === "line" && isPathALoop(multiElement.points)) {
      mutateElement(multiElement, {
        lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
      });
      App.actionManager.executeAction(actionFinalize);
      return;
    }

    const { x: rx, y: ry, lastCommittedPoint } = multiElement;

    // clicking inside commit zone → finalize arrow
    if (
      multiElement.points.length > 1 &&
      lastCommittedPoint &&
      distance2d(
        pointerDownState.origin.x - rx,
        pointerDownState.origin.y - ry,
        lastCommittedPoint[0],
        lastCommittedPoint[1],
      ) < LINE_CONFIRM_THRESHOLD
    ) {
      App.actionManager.executeAction(actionFinalize);
      return;
    }

    $app.setState((prevState) => ({
      selectedElementIds: {
        ...prevState.selectedElementIds,
        [multiElement.id]: true,
      },
    }));
    // clicking outside commit zone → update reference for last committed
    // point
    mutateElement(multiElement, {
      lastCommittedPoint: multiElement.points[multiElement.points.length - 1],
    });
    document.documentElement.style.cursor = CURSOR_TYPE.POINTER;
  } else {
    const [gridX, gridY] = getGridPoint(
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      elementType === "draw" ? null : $app.state.gridSize,
    );

    /* If arrow is pre-arrowheads, it will have undefined for both start and end arrowheads.
      If so, we want it to be null for start and "arrow" for end. If the linear item is not
      an arrow, we want it to be null for both. Otherwise, we want it to use the
      values from appState. */

    const { currentItemStartArrowhead, currentItemEndArrowhead } = $app.state;
    const [startArrowhead, endArrowhead] =
      elementType === "arrow"
        ? [currentItemStartArrowhead, currentItemEndArrowhead]
        : [null, null];

    const element = newLinearElement({
      type: elementType,
      x: gridX,
      y: gridY,
      strokeColor: $app.state.currentItemStrokeColor,
      backgroundColor: $app.state.currentItemBackgroundColor,
      fillStyle: $app.state.currentItemFillStyle,
      strokeWidth: $app.state.currentItemStrokeWidth,
      strokeStyle: $app.state.currentItemStrokeStyle,
      roughness: $app.state.currentItemRoughness,
      opacity: $app.state.currentItemOpacity,
      strokeSharpness: $app.state.currentItemLinearStrokeSharpness,
      startArrowhead,
      endArrowhead,
    });
    $app.setState((prevState) => ({
      selectedElementIds: {
        ...prevState.selectedElementIds,
        [element.id]: false,
      },
    }));
    mutateElement(element, {
      points: [...element.points, [0, 0]],
    });
    const boundElement = getHoveredElementForBinding(
      pointerDownState.origin,
      App.scene,
    );
    App.scene.replaceAllElements([
      ...App.scene.getElementsIncludingDeleted(),
      element,
    ]);
    $app.setState({
      draggingElement: element,
      editingElement: element,
      startBoundElement: boundElement,
      suggestedBindings: [],
    });
  }
};
