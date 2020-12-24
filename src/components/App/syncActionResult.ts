import { ActionResult } from "../../actions/types";
import { isNonDeletedElement } from "../../element";
import { AppState } from "../../types";
import { withBatchedUpdates } from "../../utils";
import App from "../App";

export const syncActionResult = ($app: App) =>
  withBatchedUpdates((actionResult: ActionResult) => {
    if (App.unmounted || actionResult === false) {
      return;
    }

    let editingElement: AppState["editingElement"] | null = null;
    if (actionResult.elements) {
      actionResult.elements.forEach((element) => {
        if (
          $app.state.editingElement?.id === element.id &&
          $app.state.editingElement !== element &&
          isNonDeletedElement(element)
        ) {
          editingElement = element;
        }
      });
      App.scene.replaceAllElements(actionResult.elements);
      if (actionResult.commitToHistory) {
        App.history.resumeRecording();
      }
    }

    if (actionResult.appState || editingElement) {
      if (actionResult.commitToHistory) {
        App.history.resumeRecording();
      }
      $app.setState(
        (state) => ({
          ...actionResult.appState,
          editingElement:
            editingElement || actionResult.appState?.editingElement || null,
          width: state.width,
          height: state.height,
          offsetTop: state.offsetTop,
          offsetLeft: state.offsetLeft,
        }),
        () => {
          if (actionResult.syncHistory) {
            App.history.setCurrentState(
              $app.state,
              App.scene.getElementsIncludingDeleted(),
            );
          }
        },
      );
    }
  });
