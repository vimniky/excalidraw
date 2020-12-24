import { getCommonBounds, duplicateElement } from "../../element";
import { fixBindingsAfterDuplication } from "../../element/binding";
import { ExcalidrawElement } from "../../element/types";
import { selectGroupsForSelectedElements } from "../../groups";
import { getGridPoint } from "../../math";
import { distance, viewportCoordsToSceneCoords } from "../../utils";
import App from "../App";

export const addElementsFromPasteOrLibrary = ($app: App) => (
  clipboardElements: readonly ExcalidrawElement[],
  clientX = App.cursor.x,
  clientY = App.cursor.y,
) => {
  const [minX, minY, maxX, maxY] = getCommonBounds(clipboardElements);

  const elementsCenterX = distance(minX, maxX) / 2;
  const elementsCenterY = distance(minY, maxY) / 2;

  const { x, y } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    $app.state,
  );

  const dx = x - elementsCenterX;
  const dy = y - elementsCenterY;
  const groupIdMap = new Map();

  const [gridX, gridY] = getGridPoint(dx, dy, $app.state.gridSize);

  const oldIdToDuplicatedId = new Map();
  const newElements = clipboardElements.map((element) => {
    const newElement = duplicateElement(
      $app.state.editingGroupId,
      groupIdMap,
      element,
      {
        x: element.x + gridX - minX,
        y: element.y + gridY - minY,
      },
    );
    oldIdToDuplicatedId.set(element.id, newElement.id);
    return newElement;
  });
  const nextElements = [
    ...App.scene.getElementsIncludingDeleted(),
    ...newElements,
  ];
  fixBindingsAfterDuplication(
    nextElements,
    clipboardElements,
    oldIdToDuplicatedId,
  );

  App.scene.replaceAllElements(nextElements);
  App.history.resumeRecording();
  $app.setState(
    selectGroupsForSelectedElements(
      {
        ...$app.state,
        isLibraryOpen: false,
        selectedElementIds: newElements.reduce((map, element) => {
          map[element.id] = true;
          return map;
        }, {} as any),
        selectedGroupIds: {},
      },
      App.scene.getElements(),
    ),
  );
};
