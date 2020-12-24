import { POINTER_BUTTON, CURSOR_TYPE, EVENT } from "../../constants";
import { normalizeScroll } from "../../scene";
import { withBatchedUpdates, setCursorForShape } from "../../utils";
import App from "../App";

export const handleCanvasPanUsingWheelOrSpaceDrag = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
): boolean => {
  if (
    !(
      App.gesture.pointers.size === 0 &&
      (event.button === POINTER_BUTTON.WHEEL ||
        (event.button === POINTER_BUTTON.MAIN && App.isHoldingSpace))
    )
  ) {
    return false;
  }
  App.isPanning = true;

  let nextPastePrevented = false;
  const isLinux = /Linux/.test(window.navigator.platform);

  document.documentElement.style.cursor = CURSOR_TYPE.GRABBING;
  let { clientX: lastX, clientY: lastY } = event;
  const onPointerMove = withBatchedUpdates((event: PointerEvent) => {
    const deltaX = lastX - event.clientX;
    const deltaY = lastY - event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;

    /*
     * Prevent paste event if we move while middle clicking on Linux.
     * See issue #1383.
     */
    if (
      isLinux &&
      !nextPastePrevented &&
      (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1)
    ) {
      nextPastePrevented = true;

      /* Prevent the next paste event */
      const preventNextPaste = (event: ClipboardEvent) => {
        document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
        event.stopPropagation();
      };

      /*
       * Reenable next paste in case of disabled middle click paste for
       * any reason:
       * - rigth click paste
       * - empty clipboard
       */
      const enableNextPaste = () => {
        setTimeout(() => {
          document.body.removeEventListener(EVENT.PASTE, preventNextPaste);
          window.removeEventListener(EVENT.POINTER_UP, enableNextPaste);
        }, 100);
      };

      document.body.addEventListener(EVENT.PASTE, preventNextPaste);
      window.addEventListener(EVENT.POINTER_UP, enableNextPaste);
    }

    $app.setState({
      scrollX: normalizeScroll(
        $app.state.scrollX - deltaX / $app.state.zoom.value,
      ),
      scrollY: normalizeScroll(
        $app.state.scrollY - deltaY / $app.state.zoom.value,
      ),
    });
  });
  const teardown = withBatchedUpdates(
    (App.lastPointerUp = () => {
      App.lastPointerUp = null;
      App.isPanning = false;
      if (!App.isHoldingSpace) {
        setCursorForShape($app.state.elementType);
      }
      $app.setState({
        cursorButton: "up",
      });
      $app.savePointer(event.clientX, event.clientY, "up");
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove);
      window.removeEventListener(EVENT.POINTER_UP, teardown);
      window.removeEventListener(EVENT.BLUR, teardown);
    }),
  );
  window.addEventListener(EVENT.BLUR, teardown);
  window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, {
    passive: true,
  });
  window.addEventListener(EVENT.POINTER_UP, teardown);
  return true;
};
