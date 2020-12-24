import { POINTER_BUTTON, EVENT } from "../../constants";
import App from "../App";

export const handleCanvasPointerDown = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
) => {
  event.persist();
  $app.maybeOpenContextMenuAfterPointerDownOnTouchDevices(event);
  App.maybeCleanupAfterMissingPointerUp(event);

  if (App.isPanning) {
    return;
  }

  $app.setState({
    lastPointerDownWith: event.pointerType,
    cursorButton: "down",
  });
  $app.savePointer(event.clientX, event.clientY, "down");

  if ($app.handleCanvasPanUsingWheelOrSpaceDrag(event)) {
    return;
  }

  // only handle left mouse button or touch
  if (
    event.button !== POINTER_BUTTON.MAIN &&
    event.button !== POINTER_BUTTON.TOUCH
  ) {
    return;
  }

  $app.updateGestureOnPointerDown(event);

  // fixes pointermove causing selection of UI texts #32
  event.preventDefault();
  // Preventing the event above disables default behavior
  // of defocusing potentially focused element, which is what we
  // want when clicking inside the canvas.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // don't select while panning
  if (App.gesture.pointers.size > 1) {
    return;
  }

  // State for the duration of a pointer interaction, which starts with a
  // pointerDown event, ends with a pointerUp event (or another pointerDown)
  const pointerDownState = $app.initialPointerDownState(event);

  if ($app.handleDraggingScrollBar(event, pointerDownState)) {
    return;
  }

  $app.clearSelectionIfNotUsingSelection();
  // Disable binding (state.isBindingEnabled = false) if CTL or CMD key is holing while moving the pointer
  $app.updateBindingEnabledOnPointerMove(event);

  if ($app.handleSelectionOnPointerDown(event, pointerDownState)) {
    return;
  }

  if ($app.state.elementType === "text") {
    $app.handleTextOnPointerDown(event, pointerDownState);
    return;
  } else if (
    $app.state.elementType === "arrow" ||
    $app.state.elementType === "draw" ||
    $app.state.elementType === "line"
  ) {
    $app.handleLinearElementOnPointerDown(
      event,
      $app.state.elementType,
      pointerDownState,
    );
  } else {
    $app.createGenericElementOnPointerDown(
      $app.state.elementType,
      pointerDownState,
    );
  }

  const onPointerMove = $app.onPointerMoveFromPointerDownHandler(
    pointerDownState,
  );

  const onPointerUp = $app.onPointerUpFromPointerDownHandler(pointerDownState);

  const onKeyDown = $app.onKeyDownFromPointerDownHandler(pointerDownState);
  const onKeyUp = $app.onKeyUpFromPointerDownHandler(pointerDownState);

  App.lastPointerUp = onPointerUp;

  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove);
  window.addEventListener(EVENT.POINTER_UP, onPointerUp);
  window.addEventListener(EVENT.KEYDOWN, onKeyDown);
  window.addEventListener(EVENT.KEYUP, onKeyUp);
  pointerDownState.eventListeners.onMove = onPointerMove;
  pointerDownState.eventListeners.onUp = onPointerUp;
  pointerDownState.eventListeners.onKeyUp = onKeyUp;
  pointerDownState.eventListeners.onKeyDown = onKeyDown;
};
