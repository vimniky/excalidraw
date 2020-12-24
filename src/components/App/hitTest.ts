import { getCommonBounds } from "../../element";
import { ExcalidrawElement } from "../../element/types";
import App from "../App";

export const isHittingCommonBoundingBoxOfSelectedElements = ($app: App) => (
  point: Readonly<{ x: number; y: number }>,
  selectedElements: readonly ExcalidrawElement[],
): boolean => {
  if (selectedElements.length < 2) {
    return false;
  }

  // How many pixels off the shape boundary we still consider a hit
  const threshold = 10 / $app.state.zoom.value;
  const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
  return (
    point.x > x1 - threshold &&
    point.x < x2 + threshold &&
    point.y > y1 - threshold &&
    point.y < y2 + threshold
  );
};
