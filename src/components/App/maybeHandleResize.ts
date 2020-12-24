import { transformElements } from "../../element";
import {
  getRotateWithDiscreteAngleKey,
  getResizeCenterPointKey,
  getResizeWithSidesSameLengthKey,
} from "../../keys";
import { getGridPoint } from "../../math";
import { getSelectedElements } from "../../scene";
import App, { PointerDownState } from "../App";

export const maybeHandleResize = ($app: App) => (
  pointerDownState: PointerDownState,
  event: MouseEvent | KeyboardEvent,
): boolean => {
  const selectedElements = getSelectedElements(
    App.scene.getElements(),
    $app.state,
  );
  const transformHandleType = pointerDownState.resize.handleType;
  $app.setState({
    // TODO: rename this state field to "isScaling" to distinguish
    // it from the generic "isResizing" which includes scaling and
    // rotating
    isResizing: transformHandleType && transformHandleType !== "rotation",
    isRotating: transformHandleType === "rotation",
  });
  const pointerCoords = pointerDownState.lastCoords;
  const [resizeX, resizeY] = getGridPoint(
    pointerCoords.x - pointerDownState.resize.offset.x,
    pointerCoords.y - pointerDownState.resize.offset.y,
    $app.state.gridSize,
  );
  if (
    transformElements(
      pointerDownState,
      transformHandleType,
      (newTransformHandle) => {
        pointerDownState.resize.handleType = newTransformHandle;
      },
      selectedElements,
      pointerDownState.resize.arrowDirection,
      getRotateWithDiscreteAngleKey(event),
      getResizeCenterPointKey(event),
      getResizeWithSidesSameLengthKey(event),
      resizeX,
      resizeY,
      pointerDownState.resize.center.x,
      pointerDownState.resize.center.y,
    )
  ) {
    $app.maybeSuggestBindingForAll(selectedElements);
    return true;
  }
  return false;
};
