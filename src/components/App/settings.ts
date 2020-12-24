import { trackEvent, EVENT_SHAPE, EVENT_DIALOG } from "../../analytics";
import { GRID_SIZE } from "../../constants";
import App from "../App";

export const toggleLock = ($app: App) => () => {
  $app.setState((prevState) => {
    trackEvent(EVENT_SHAPE, "lock", !prevState.elementLocked ? "on" : "off");
    return {
      elementLocked: !prevState.elementLocked,
      elementType: prevState.elementLocked
        ? "selection"
        : prevState.elementType,
    };
  });
};
export const toggleZenMode = ($app: App) => () => {
  $app.setState({
    zenModeEnabled: !$app.state.zenModeEnabled,
  });
};

export const toggleGridMode = ($app: App) => () => {
  $app.setState({
    gridSize: $app.state.gridSize ? null : GRID_SIZE,
  });
};

export const toggleStats = ($app: App) => () => {
  if (!$app.state.showStats) {
    trackEvent(EVENT_DIALOG, "stats");
  }
  $app.setState({
    showStats: !$app.state.showStats,
  });
};
