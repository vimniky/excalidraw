import {
  DEFAULT_VERTICAL_ALIGN,
  TEXT_TO_CENTER_SNAP_THRESHOLD,
} from "../../constants";
import {
  isNonDeletedElement,
  isTextElement,
  newTextElement,
  textWysiwyg,
  updateTextElement,
} from "../../element";
import {
  updateBoundElements,
  fixBindingsAfterDeletion,
} from "../../element/binding";
import { mutateElement } from "../../element/mutateElement";
import { ExcalidrawTextElement, NonDeleted } from "../../element/types";
import { getElementContainingPosition } from "../../scene";
import { AppState } from "../../types";
import {
  resetCursor,
  sceneCoordsToViewportCoords,
  setCursorForShape,
  withBatchedUpdates,
} from "../../utils";
import App, { PointerDownState } from "../App";

const getTextWysiwygSnappedToCenterPosition = (
  x: number,
  y: number,
  appState: Pick<
    AppState,
    "zoom" | "offsetLeft" | "offsetTop" | "scrollX" | "scrollY"
  >,
) => {
  const elementClickedInside = getElementContainingPosition(
    App.scene
      .getElementsIncludingDeleted()
      .filter((element) => !isTextElement(element)),
    x,
    y,
  );
  if (elementClickedInside) {
    const elementCenterX =
      elementClickedInside.x + elementClickedInside.width / 2;
    const elementCenterY =
      elementClickedInside.y + elementClickedInside.height / 2;
    const distanceToCenter = Math.hypot(x - elementCenterX, y - elementCenterY);
    const isSnappedToCenter = distanceToCenter < TEXT_TO_CENTER_SNAP_THRESHOLD;
    if (isSnappedToCenter) {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        { sceneX: elementCenterX, sceneY: elementCenterY },
        appState,
      );
      return { viewportX, viewportY, elementCenterX, elementCenterY };
    }
  }
};

export const startTextEditing = ($app: App) => ({
  sceneX,
  sceneY,
  insertAtParentCenter = true,
}: {
  /** X position to insert text at */
  sceneX: number;
  /** Y position to insert text at */
  sceneY: number;
  /** whether to attempt to insert at element center if applicable */
  insertAtParentCenter?: boolean;
}) => {
  const existingTextElement = $app.getTextElementAtPosition(sceneX, sceneY);

  const parentCenterPosition =
    insertAtParentCenter &&
    getTextWysiwygSnappedToCenterPosition(sceneX, sceneY, $app.state);

  const element = existingTextElement
    ? existingTextElement
    : newTextElement({
        x: parentCenterPosition ? parentCenterPosition.elementCenterX : sceneX,
        y: parentCenterPosition ? parentCenterPosition.elementCenterY : sceneY,
        strokeColor: $app.state.currentItemStrokeColor,
        backgroundColor: $app.state.currentItemBackgroundColor,
        fillStyle: $app.state.currentItemFillStyle,
        strokeWidth: $app.state.currentItemStrokeWidth,
        strokeStyle: $app.state.currentItemStrokeStyle,
        roughness: $app.state.currentItemRoughness,
        opacity: $app.state.currentItemOpacity,
        strokeSharpness: $app.state.currentItemStrokeSharpness,
        text: "",
        fontSize: $app.state.currentItemFontSize,
        fontFamily: $app.state.currentItemFontFamily,
        textAlign: parentCenterPosition
          ? "center"
          : $app.state.currentItemTextAlign,
        verticalAlign: parentCenterPosition ? "middle" : DEFAULT_VERTICAL_ALIGN,
      });

  $app.setState({ editingElement: element });

  if (existingTextElement) {
    // if text element is no longer centered to a container, reset
    // verticalAlign to default because it's currently internal-only
    if (!parentCenterPosition || element.textAlign !== "center") {
      mutateElement(element, { verticalAlign: DEFAULT_VERTICAL_ALIGN });
    }
  } else {
    App.scene.replaceAllElements([
      ...App.scene.getElementsIncludingDeleted(),
      element,
    ]);

    // case: creating new text not centered to parent elemenent → offset Y
    // so that the text is centered to cursor position
    if (!parentCenterPosition) {
      mutateElement(element, {
        y: element.y - element.baseline / 2,
      });
    }
  }

  $app.setState({
    editingElement: element,
  });

  $app.handleTextWysiwyg(element, {
    isExistingElement: !!existingTextElement,
  });
};

export const handleTextWysiwyg = ($app: App) => (
  element: ExcalidrawTextElement,
  {
    isExistingElement = false,
  }: {
    isExistingElement?: boolean;
  },
) => {
  const updateElement = (text: string, isDeleted = false) => {
    App.scene.replaceAllElements([
      ...App.scene.getElementsIncludingDeleted().map((_element) => {
        if (_element.id === element.id && isTextElement(_element)) {
          return updateTextElement(_element, {
            text,
            isDeleted,
          });
        }
        return _element;
      }),
    ]);
  };

  textWysiwyg({
    id: element.id,
    appState: $app.state,
    getViewportCoords: (x, y) => {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        {
          sceneX: x,
          sceneY: y,
        },
        $app.state,
      );
      return [viewportX, viewportY];
    },
    onChange: withBatchedUpdates((text) => {
      updateElement(text);
      if (isNonDeletedElement(element)) {
        updateBoundElements(element);
      }
    }),
    onSubmit: withBatchedUpdates((text) => {
      const isDeleted = !text.trim();
      updateElement(text, isDeleted);
      if (!isDeleted) {
        $app.setState((prevState) => ({
          selectedElementIds: {
            ...prevState.selectedElementIds,
            [element.id]: true,
          },
        }));
      } else {
        fixBindingsAfterDeletion(App.scene.getElements(), [element]);
      }
      if (!isDeleted || isExistingElement) {
        App.history.resumeRecording();
      }

      $app.setState({
        draggingElement: null,
        editingElement: null,
      });
      if ($app.state.elementLocked) {
        setCursorForShape($app.state.elementType);
      }
    }),
    element,
  });
  // deselect all other elements when inserting text
  $app.setState({
    selectedElementIds: {},
    selectedGroupIds: {},
    editingGroupId: null,
  });

  // do an initial update to re-initialize element position since we were
  // modifying element's x/y for sake of editor (case: syncing to remote)
  updateElement(element.text);
};

export const handleTextOnPointerDown = ($app: App) => (
  event: React.PointerEvent<HTMLCanvasElement>,
  pointerDownState: PointerDownState,
): void => {
  // if we're currently still editing text, clicking outside
  // should only finalize it, not create another (irrespective
  // of state.elementLocked)
  if ($app.state.editingElement?.type === "text") {
    return;
  }

  $app.startTextEditing({
    sceneX: pointerDownState.origin.x,
    sceneY: pointerDownState.origin.y,
    insertAtParentCenter: !event.altKey,
  });

  resetCursor();
  if (!$app.state.elementLocked) {
    $app.setState({
      elementType: "selection",
    });
  }
};

export const getTextElementAtPosition = ($app: App) => (
  x: number,
  y: number,
): NonDeleted<ExcalidrawTextElement> | null => {
  const element = $app.getElementAtPosition(x, y);

  if (element && isTextElement(element) && !element.isDeleted) {
    return element;
  }
  return null;
};
