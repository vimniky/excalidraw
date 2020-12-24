import { viewportCoordsToSceneCoords } from "../../utils";
import App from "../App";

export const savePointer = ($app: App) => (
  x: number,
  y: number,
  button: "up" | "down",
) => {
  if (!x || !y) {
    return;
  }
  const pointer = viewportCoordsToSceneCoords(
    { clientX: x, clientY: y },
    $app.state,
  );

  if (isNaN(pointer.x) || isNaN(pointer.y)) {
    // sometimes the pointer goes off screen
  }

  $app.props.onPointerUpdate?.({
    pointer,
    button,
    pointersMap: App.gesture.pointers,
  });
};
