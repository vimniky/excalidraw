import { getCommonBounds } from "../../element";
import { deepCopyElement } from "../../element/newElement";
import { getGridPoint } from "../../math";
import { getSelectedElements, isOverScrollBars } from "../../scene";
import { viewportCoordsToSceneCoords, tupleToCoors } from "../../utils";
import App, { PointerDownState } from "../App";

export const initialPointerDownState = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
): PointerDownState => {
  const origin = viewportCoordsToSceneCoords(event, $app.state);
  const selectedElements = getSelectedElements(
    App.scene.getElements(),
    $app.state,
  );
  const [minX, minY, maxX, maxY] = getCommonBounds(selectedElements);

  return {
    origin,
    originInGrid: tupleToCoors(
      getGridPoint(origin.x, origin.y, $app.state.gridSize),
    ),
    scrollbars: isOverScrollBars(
      App.currentScrollBars,
      event.clientX,
      event.clientY,
    ),
    // we need to duplicate because we'll be updating this state
    lastCoords: { ...origin },
    originalElements: App.scene.getElements().reduce((acc, element) => {
      acc.set(element.id, deepCopyElement(element));
      return acc;
    }, new Map() as PointerDownState["originalElements"]),
    resize: {
      handleType: false,
      isResizing: false,
      offset: { x: 0, y: 0 },
      arrowDirection: "origin",
      center: { x: (maxX + minX) / 2, y: (maxY + minY) / 2 },
    },
    hit: {
      element: null,
      allHitElements: [],
      wasAddedToSelection: false,
      hasBeenDuplicated: false,
      hasHitCommonBoundingBoxOfSelectedElements: $app.isHittingCommonBoundingBoxOfSelectedElements(
        origin,
        selectedElements,
      ),
    },
    drag: {
      hasOccurred: false,
      offset: null,
    },
    eventListeners: {
      onMove: null,
      onUp: null,
      onKeyUp: null,
      onKeyDown: null,
    },
  };
};
