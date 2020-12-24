import { trackEvent, EVENT_SHAPE } from "../../analytics";
import { LinearElementEditor } from "../../element/linearElementEditor";
import { isLinearElement } from "../../element/typeChecks";
import {
  getSelectedGroupIds,
  getSelectedGroupIdForElement,
  selectGroupsForSelectedElements,
} from "../../groups";
import { KEYS } from "../../keys";
import { getSelectedElements } from "../../scene";
import { resetCursor, viewportCoordsToSceneCoords } from "../../utils";
import App from "../App";

export const handleCanvasDoubleClick = ($app: App) => (
  event: React.MouseEvent<HTMLCanvasElement>,
) => {
  // case: double-clicking with arrow/line tool selected would both create
  // text and enter multiElement mode
  if ($app.state.multiElement) {
    return;
  }
  // we should only be able to double click when mode is selection
  if ($app.state.elementType !== "selection") {
    return;
  }

  const selectedElements = getSelectedElements(
    App.scene.getElements(),
    $app.state,
  );

  if (selectedElements.length === 1 && isLinearElement(selectedElements[0])) {
    if (
      !$app.state.editingLinearElement ||
      $app.state.editingLinearElement.elementId !== selectedElements[0].id
    ) {
      App.history.resumeRecording();
      $app.setState({
        editingLinearElement: new LinearElementEditor(
          selectedElements[0],
          App.scene,
        ),
      });
    }
    return;
  }

  resetCursor();

  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    event,
    $app.state,
  );

  const selectedGroupIds = getSelectedGroupIds($app.state);

  if (selectedGroupIds.length > 0) {
    const hitElement = $app.getElementAtPosition(sceneX, sceneY);

    const selectedGroupId =
      hitElement &&
      getSelectedGroupIdForElement(hitElement, $app.state.selectedGroupIds);

    if (selectedGroupId) {
      $app.setState((prevState) =>
        selectGroupsForSelectedElements(
          {
            ...prevState,
            editingGroupId: selectedGroupId,
            selectedElementIds: { [hitElement!.id]: true },
            selectedGroupIds: {},
          },
          App.scene.getElements(),
        ),
      );
      return;
    }
  }

  resetCursor();

  if (!event[KEYS.CTRL_OR_CMD]) {
    trackEvent(EVENT_SHAPE, "text", "double-click");
    $app.startTextEditing({
      sceneX,
      sceneY,
      insertAtParentCenter: !event.altKey,
    });
  }
};
