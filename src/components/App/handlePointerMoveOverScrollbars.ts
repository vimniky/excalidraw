import { normalizeScroll } from "../../scene";
import App, { PointerDownState } from "../App";

export const handlePointerMoveOverScrollbars = ($app: App) => (
  event: PointerEvent,
  pointerDownState: PointerDownState,
): boolean => {
  if (pointerDownState.scrollbars.isOverHorizontal) {
    const x = event.clientX;
    const dx = x - pointerDownState.lastCoords.x;
    $app.setState({
      scrollX: normalizeScroll($app.state.scrollX - dx / $app.state.zoom.value),
    });
    pointerDownState.lastCoords.x = x;
    return true;
  }

  if (pointerDownState.scrollbars.isOverVertical) {
    const y = event.clientY;
    const dy = y - pointerDownState.lastCoords.y;
    $app.setState({
      scrollY: normalizeScroll($app.state.scrollY - dy / $app.state.zoom.value),
    });
    pointerDownState.lastCoords.y = y;
    return true;
  }
  return false;
};
