import { getNewZoom, getNormalizedZoom, normalizeScroll } from "../../scene";
import { withBatchedUpdates } from "../../utils";
import App from "../App";

export const handleWheel = ($app: App) =>
  withBatchedUpdates((event: WheelEvent) => {
    event.preventDefault();

    if (App.isPanning) {
      return;
    }

    const { deltaX, deltaY } = event;
    const { selectedElementIds, previousSelectedElementIds } = $app.state;
    // note that event.ctrlKey is necessary to handle pinch zooming
    if (event.metaKey || event.ctrlKey) {
      const sign = Math.sign(deltaY);
      const MAX_STEP = 10;
      let delta = Math.abs(deltaY);
      if (delta > MAX_STEP) {
        delta = MAX_STEP;
      }
      delta *= sign;
      if (Object.keys(previousSelectedElementIds).length !== 0) {
        setTimeout(() => {
          $app.setState({
            selectedElementIds: previousSelectedElementIds,
            previousSelectedElementIds: {},
          });
        }, 1000);
      }

      $app.setState(({ zoom, offsetLeft, offsetTop }) => ({
        zoom: getNewZoom(
          getNormalizedZoom(zoom.value - delta / 100),
          zoom,
          { left: offsetLeft, top: offsetTop },
          {
            x: App.cursor.x,
            y: App.cursor.y,
          },
        ),
        selectedElementIds: {},
        previousSelectedElementIds:
          Object.keys(selectedElementIds).length !== 0
            ? selectedElementIds
            : previousSelectedElementIds,
        shouldCacheIgnoreZoom: true,
      }));
      $app.resetShouldCacheIgnoreZoomDebounced();
      return;
    }

    // scroll horizontally when shift pressed
    if (event.shiftKey) {
      $app.setState(({ zoom, scrollX }) => ({
        // on Mac, shift+wheel tends to result in deltaX
        scrollX: normalizeScroll(scrollX - (deltaY || deltaX) / zoom.value),
      }));
      return;
    }

    $app.setState(({ zoom, scrollX, scrollY }) => ({
      scrollX: normalizeScroll(scrollX - deltaX / zoom.value),
      scrollY: normalizeScroll(scrollY - deltaY / zoom.value),
    }));
  });
