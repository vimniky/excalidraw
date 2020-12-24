import { getNonDeletedElements } from "../../element";
import { ExcalidrawElement } from "../../element/types";
import { calculateScrollCenter } from "../../scene";
import App from "../App";

export const setScrollToCenter = ($app: App) => (
  remoteElements: readonly ExcalidrawElement[],
) => {
  $app.setState({
    ...calculateScrollCenter(
      getNonDeletedElements(remoteElements),
      $app.state,
      App.canvas,
    ),
  });
};
