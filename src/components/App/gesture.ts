import { getCenter, getDistance } from "../../gesture";
import { getNewZoom, getNormalizedZoom } from "../../scene";
import { GestureEvent } from "../../types";
import { withBatchedUpdates } from "../../utils";
import App from "../App";

export const onGestureStart = ($app: App) =>
  withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    $app.setState({
      selectedElementIds: {},
    });
    App.gesture.initialScale = $app.state.zoom.value;
  });
export const onGestureChange = ($app: App) =>
  withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();

    // onGestureChange only has zoom factor but not the center.
    // If we're on iPad or iPhone, then we recognize multi-touch and will
    // zoom in at the right location on the touchMove handler already.
    // On Macbook, we don't have those events so will zoom in at the
    // current location instead.
    if (App.gesture.pointers.size === 2) {
      return;
    }

    const initialScale = App.gesture.initialScale;
    if (initialScale) {
      $app.setState(({ zoom, offsetLeft, offsetTop }) => ({
        zoom: getNewZoom(
          getNormalizedZoom(initialScale * event.scale),
          zoom,
          { left: offsetLeft, top: offsetTop },
          { x: App.cursor.x, y: App.cursor.y },
        ),
      }));
    }
  });

export const onGestureEnd = ($app: App) =>
  withBatchedUpdates((event: GestureEvent) => {
    event.preventDefault();
    $app.setState({
      previousSelectedElementIds: {},
      selectedElementIds: $app.state.previousSelectedElementIds,
    });
    App.gesture.initialScale = null;
  });

export const updateGestureOnPointerDown = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
): void => {
  App.gesture.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });

  if (App.gesture.pointers.size === 2) {
    App.gesture.lastCenter = getCenter(App.gesture.pointers);
    App.gesture.initialScale = $app.state.zoom.value;
    App.gesture.initialDistance = getDistance(
      Array.from(App.gesture.pointers.values()),
    );
  }
};
