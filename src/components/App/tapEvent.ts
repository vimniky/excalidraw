import { TAP_TWICE_TIMEOUT } from "../../constants";
import App from "../App";

export const onTapStart = ($app: App) => (event: TouchEvent) => {
  if (!App.didTapTwice) {
    App.didTapTwice = true;
    clearTimeout(App.tappedTwiceTimer);
    App.tappedTwiceTimer = window.setTimeout(
      App.resetTapTwice,
      TAP_TWICE_TIMEOUT,
    );
    return;
  }
  // insert text only if we tapped twice with a single finger
  // event.touches.length === 1 will also prevent inserting text when user's zooming
  if (App.didTapTwice && event.touches.length === 1) {
    const [touch] = event.touches;
    // @ts-ignore
    $app.handleCanvasDoubleClick({
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    App.didTapTwice = false;
    clearTimeout(App.tappedTwiceTimer);
  }
  event.preventDefault();
  if (event.touches.length === 2) {
    $app.setState({
      selectedElementIds: {},
    });
  }
};

export const onTapEnd = ($app: App) => (event: TouchEvent) => {
  event.preventDefault();
  if (event.touches.length > 0) {
    $app.setState({
      previousSelectedElementIds: {},
      selectedElementIds: $app.state.previousSelectedElementIds,
    });
  }
};
