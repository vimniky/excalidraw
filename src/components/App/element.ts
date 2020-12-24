import {
  isHittingElementBoundingBoxWithoutHittingElement,
  hitTest,
} from "../../element";
import { NonDeleted, ExcalidrawElement } from "../../element/types";
import { getElementsAtPosition } from "../../scene";
import App from "../App";

export const getElementAtPosition = ($app: App) => (
  x: number,
  y: number,
): NonDeleted<ExcalidrawElement> | null => {
  const allHitElements = $app.getElementsAtPosition(x, y);
  if (allHitElements.length > 1) {
    const elementWithHighestZIndex = allHitElements[allHitElements.length - 1];
    // If we're hitting element with highest z-index only on its bounding box
    // while also hitting other element figure, the latter should be considered.
    return isHittingElementBoundingBoxWithoutHittingElement(
      elementWithHighestZIndex,
      $app.state,
      x,
      y,
    )
      ? allHitElements[allHitElements.length - 2]
      : elementWithHighestZIndex;
  }
  if (allHitElements.length === 1) {
    return allHitElements[0];
  }
  return null;
};

export const getAllElementsAtPosition = ($app: App) => (
  x: number,
  y: number,
): NonDeleted<ExcalidrawElement>[] => {
  return getElementsAtPosition(App.scene.getElements(), (element) =>
    hitTest(element, $app.state, x, y),
  );
};
