import { isLinearElementType } from "../../element/typeChecks";
import { AppState } from "../../types";
import { setCursorForShape, isToolIcon } from "../../utils";
import App from "../App";

export const selectShapeTool = ($app: App) => (
  elementType: AppState["elementType"],
) => {
  if (!App.isHoldingSpace) {
    setCursorForShape(elementType);
  }
  if (isToolIcon(document.activeElement)) {
    document.activeElement.blur();
  }
  if (!isLinearElementType(elementType)) {
    $app.setState({ suggestedBindings: [] });
  }
  if (elementType !== "selection") {
    $app.setState({
      elementType,
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    });
  } else {
    $app.setState({ elementType });
  }
};
