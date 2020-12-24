import { actionDeleteSelected } from "../../actions";
import { renderSpreadsheet } from "../../charts";
import { copyToClipboard, parseClipboard } from "../../clipboard";
import { DEFAULT_VERTICAL_ALIGN } from "../../constants";
import { exportCanvas } from "../../data";
import { newTextElement } from "../../element";
import { getSelectedElements } from "../../scene";
import {
  withBatchedUpdates,
  isWritableElement,
  viewportCoordsToSceneCoords,
} from "../../utils";
import App from "../App";

export const onCut = ($app: App) =>
  withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    $app.cutAll();
    event.preventDefault();
  });

export const onCopy = ($app: App) =>
  withBatchedUpdates((event: ClipboardEvent) => {
    if (isWritableElement(event.target)) {
      return;
    }
    $app.copyAll();
    event.preventDefault();
  });

export const cutAll = ($app: App) => () => {
  $app.copyAll();
  App.actionManager.executeAction(actionDeleteSelected);
};

export const copyAll = ($app: App) => () => {
  copyToClipboard(App.scene.getElements(), $app.state);
};

export const copyToClipboardAsPng = ($app: App) => async () => {
  const elements = App.scene.getElements();

  const selectedElements = getSelectedElements(elements, $app.state);
  try {
    await exportCanvas(
      "clipboard",
      selectedElements.length ? selectedElements : elements,
      $app.state,
      App.canvas!,
      $app.state,
    );
  } catch (error) {
    console.error(error);
    $app.setState({ errorMessage: error.message });
  }
};

export const copyToClipboardAsSvg = ($app: App) => async () => {
  const selectedElements = getSelectedElements(
    App.scene.getElements(),
    $app.state,
  );
  try {
    await exportCanvas(
      "clipboard-svg",
      selectedElements.length ? selectedElements : App.scene.getElements(),
      $app.state,
      App.canvas!,
      $app.state,
    );
  } catch (error) {
    console.error(error);
    $app.setState({ errorMessage: error.message });
  }
};

export const pasteFromClipboard = ($app: App) =>
  withBatchedUpdates(async (event: ClipboardEvent | null) => {
    // #686
    const target = document.activeElement;
    const elementUnderCursor = document.elementFromPoint(
      App.cursor.x,
      App.cursor.y,
    );
    if (
      // if no ClipboardEvent supplied, assume we're pasting via contextMenu
      // thus these checks don't make sense
      event &&
      (!(elementUnderCursor instanceof HTMLCanvasElement) ||
        isWritableElement(target))
    ) {
      return;
    }
    const data = await parseClipboard(event);
    if (data.errorMessage) {
      $app.setState({ errorMessage: data.errorMessage });
    } else if (data.spreadsheet) {
      $app.addElementsFromPasteOrLibrary(
        renderSpreadsheet(data.spreadsheet, App.cursor.x, App.cursor.y),
      );
    } else if (data.elements) {
      $app.addElementsFromPasteOrLibrary(data.elements);
    } else if (data.text) {
      $app.addTextFromPaste(data.text);
    }
    $app.selectShapeTool("selection");
    event?.preventDefault();
  });

export const addTextFromPaste = ($app: App) => (text: any) => {
  const { x, y } = viewportCoordsToSceneCoords(
    { clientX: App.cursor.x, clientY: App.cursor.y },
    $app.state,
  );

  const element = newTextElement({
    x,
    y,
    strokeColor: $app.state.currentItemStrokeColor,
    backgroundColor: $app.state.currentItemBackgroundColor,
    fillStyle: $app.state.currentItemFillStyle,
    strokeWidth: $app.state.currentItemStrokeWidth,
    strokeStyle: $app.state.currentItemStrokeStyle,
    roughness: $app.state.currentItemRoughness,
    opacity: $app.state.currentItemOpacity,
    strokeSharpness: $app.state.currentItemStrokeSharpness,
    text,
    fontSize: $app.state.currentItemFontSize,
    fontFamily: $app.state.currentItemFontFamily,
    textAlign: $app.state.currentItemTextAlign,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
  });

  App.scene.replaceAllElements([
    ...App.scene.getElementsIncludingDeleted(),
    element,
  ]);
  $app.setState({ selectedElementIds: { [element.id]: true } });
  App.history.resumeRecording();
};
