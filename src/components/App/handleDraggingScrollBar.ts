import { EVENT } from "../../constants";
import { withBatchedUpdates, setCursorForShape } from "../../utils";
import App, { PointerDownState } from "../App";

export const handleDraggingScrollBar = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
  pointerDownState: PointerDownState,
): boolean => {
  if (!(pointerDownState.scrollbars.isOverEither && !$app.state.multiElement)) {
    return false;
  }
  App.isDraggingScrollBar = true;
  pointerDownState.lastCoords.x = event.clientX;
  pointerDownState.lastCoords.y = event.clientY;
  const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    $app.handlePointerMoveOverScrollbars(event, pointerDownState);
  });

  const onPointerUp = withBatchedUpdates(() => {
    App.isDraggingScrollBar = false;
    setCursorForShape($app.state.elementType);
    App.lastPointerUp = null;
    $app.setState({
      cursorButton: "up",
    });
    $app.savePointer(event.clientX, event.clientY, "up");
    window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
    window.removeEventListener(EVENT.POINTER_UP, onPointerUp);
  });

  App.lastPointerUp = onPointerUp;

  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
  window.addEventListener(EVENT.POINTER_UP, onPointerUp);
  return true;
};
