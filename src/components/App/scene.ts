import { getDefaultAppState } from "../../appState";
import { loadFromBlob } from "../../data";
import { restore } from "../../data/restore";
import { calculateScrollCenter } from "../../scene";
import { SceneData } from "../../types";
import { withBatchedUpdates } from "../../utils";
import App from "../App";

export const initializeScene = ($app: App) => async () => {
  if ("launchQueue" in window && "LaunchParams" in window) {
    (window as any).launchQueue.setConsumer(
      async (launchParams: { files: any[] }) => {
        if (!launchParams.files.length) {
          return;
        }
        const fileHandle = launchParams.files[0];
        const blob: Blob = await fileHandle.getFile();
        blob.handle = fileHandle;
        loadFromBlob(blob, $app.state)
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
      },
    );
  }

  if (!$app.state.isLoading) {
    $app.setState({ isLoading: true });
  }

  let initialData = null;
  try {
    initialData = (await $app.props.initialData) || null;
  } catch (error) {
    console.error(error);
  }

  const scene = restore(initialData, null);

  scene.appState = {
    ...scene.appState,
    ...calculateScrollCenter(
      scene.elements,
      {
        ...scene.appState,
        width: $app.state.width,
        height: $app.state.height,
        offsetTop: $app.state.offsetTop,
        offsetLeft: $app.state.offsetLeft,
      },
      null,
    ),
    isLoading: false,
  };

  App.resetHistory();
  $app.syncActionResult({
    ...scene,
    commitToHistory: true,
  });

  const addToLibraryUrl = new URLSearchParams(window.location.search).get(
    "addLibrary",
  );

  if (addToLibraryUrl) {
    await $app.importLibraryFromUrl(addToLibraryUrl);
  }
};

export const onSceneUpdated = ($app: App) => () => {
  $app.setState({});
};

export const updateScene = ($app: App) =>
  withBatchedUpdates((sceneData: SceneData) => {
    if (sceneData.commitToHistory) {
      App.history.resumeRecording();
    }

    // currently we only support syncing background color
    if (sceneData.appState?.viewBackgroundColor) {
      $app.setState({
        viewBackgroundColor: sceneData.appState.viewBackgroundColor,
      });
    }

    if (sceneData.elements) {
      App.scene.replaceAllElements(sceneData.elements);
    }

    if (sceneData.collaborators) {
      $app.setState({ collaborators: sceneData.collaborators });
    }
  });

export const resetScene = ($app: App) =>
  withBatchedUpdates((opts?: { resetLoadingState: boolean }) => {
    App.scene.replaceAllElements([]);
    $app.setState((state) => ({
      ...getDefaultAppState(),
      isLoading: opts?.resetLoadingState ? false : state.isLoading,
      appearance: $app.state.appearance,
    }));
    App.resetHistory();
  });
