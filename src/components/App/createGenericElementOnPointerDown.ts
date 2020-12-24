import { newElement } from "../../element";
import { ExcalidrawGenericElement } from "../../element/types";
import { getGridPoint } from "../../math";
import App, { PointerDownState } from "../App";

export const createGenericElementOnPointerDown = ($app: App) => (
  elementType: ExcalidrawGenericElement["type"],
  pointerDownState: PointerDownState,
): void => {
  const [gridX, gridY] = getGridPoint(
    pointerDownState.origin.x,
    pointerDownState.origin.y,
    $app.state.gridSize,
  );
  const element = newElement({
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
    strokeSharpness: $app.state.currentItemStrokeSharpness,
  });

  if (element.type === "selection") {
    $app.setState({
      selectionElement: element,
      draggingElement: element,
    });
  } else {
    App.scene.replaceAllElements([
      ...App.scene.getElementsIncludingDeleted(),
      element,
    ]);
    $app.setState({
      multiElement: null,
      draggingElement: element,
      editingElement: element,
    });
  }
};
