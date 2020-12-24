import { dragNewElement } from "../../element";
import {
  getResizeWithSidesSameLengthKey,
  getResizeCenterPointKey,
} from "../../keys";
import { getGridPoint } from "../../math";
import { distance } from "../../utils";
import App, { PointerDownState } from "../App";

export const maybeDragNewGenericElement = ($app: App) => (
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
): void => {
  const draggingElement = $app.state.draggingElement;
  const pointerCoords = pointerDownState.lastCoords;
  if (!draggingElement) {
    return;
  }
  if (draggingElement.type === "selection") {
    dragNewElement(
      draggingElement,
      $app.state.elementType,
      pointerDownState.origin.x,
      pointerDownState.origin.y,
      pointerCoords.x,
      pointerCoords.y,
      distance(pointerDownState.origin.x, pointerCoords.x),
      distance(pointerDownState.origin.y, pointerCoords.y),
      getResizeWithSidesSameLengthKey(event),
      getResizeCenterPointKey(event),
    );
  } else {
    const [gridX, gridY] = getGridPoint(
      pointerCoords.x,
      pointerCoords.y,
      $app.state.gridSize,
    );
    dragNewElement(
      draggingElement,
      $app.state.elementType,
      pointerDownState.originInGrid.x,
      pointerDownState.originInGrid.y,
      gridX,
      gridY,
      distance(pointerDownState.originInGrid.x, gridX),
      distance(pointerDownState.originInGrid.y, gridY),
      getResizeWithSidesSameLengthKey(event),
      getResizeCenterPointKey(event),
    );
    $app.maybeSuggestBindingForAll([draggingElement]);
  }
};
