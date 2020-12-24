import { MIME_TYPES } from "../../constants";
import { loadFromBlob } from "../../data";
import { Library } from "../../data/library";
import { t } from "../../i18n";
import App from "../App";

export const handleCanvasOnDrop = ($app: App) => async (
  event: React.DragEvent<HTMLCanvasElement>,
) => {
  try {
    const file = event.dataTransfer.files[0];
    if (file?.type === "image/png" || file?.type === "image/svg+xml") {
      const { elements, appState } = await loadFromBlob(file, $app.state);
      $app.syncActionResult({
        elements,
        appState: {
          ...(appState || $app.state),
          isLoading: false,
        },
        commitToHistory: true,
      });
      return;
    }
  } catch (error) {
    return $app.setState({
      isLoading: false,
      errorMessage: error.message,
    });
  }

  const libraryShapes = event.dataTransfer.getData(MIME_TYPES.excalidrawlib);
  if (libraryShapes !== "") {
    $app.addElementsFromPasteOrLibrary(
      JSON.parse(libraryShapes),
      event.clientX,
      event.clientY,
    );
    return;
  }

  const file = event.dataTransfer?.files[0];
  if (file?.type === "application/json" || file?.name.endsWith(".excalidraw")) {
    $app.setState({ isLoading: true });
    if ("chooseFileSystemEntries" in window || "showOpenFilePicker" in window) {
      try {
        // This will only work as of Chrome 86,
        // but can be safely ignored on older releases.
        const item = event.dataTransfer.items[0];
        // TODO: Make this part of `AppState`.
        (file as any).handle = await (item as any).getAsFileSystemHandle();
      } catch (error) {
        console.warn(error.name, error.message);
      }
    }
    loadFromBlob(file, $app.state)
      .then(({ elements, appState }) =>
        $app.syncActionResult({
          elements,
          appState: {
            ...(appState || $app.state),
            isLoading: false,
          },
          commitToHistory: true,
        }),
      )
      .catch((error) => {
        $app.setState({ isLoading: false, errorMessage: error.message });
      });
  } else if (
    file?.type === MIME_TYPES.excalidrawlib ||
    file?.name.endsWith(".excalidrawlib")
  ) {
    Library.importLibrary(file)
      .then(() => {
        $app.setState({ isLibraryOpen: false });
      })
      .catch((error) =>
        $app.setState({ isLoading: false, errorMessage: error.message }),
      );
  } else {
    $app.setState({
      isLoading: false,
      errorMessage: t("alerts.couldNotLoadInvalidFile"),
    });
  }
};
