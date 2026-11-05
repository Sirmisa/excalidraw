import {
  useApp,
  useEditorInterface,
  useAppProps,
} from "@excalidraw/excalidraw/components/App";
import { overwriteConfirmStateAtom } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { isSidebarDockedAtom } from "@excalidraw/excalidraw/components/Sidebar/Sidebar";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useAtomValue } from "@excalidraw/excalidraw/editor-jotai";

import { DrawingCompanionView } from "./DrawingCompanionView";
import { useCompanionBehavior } from "./useCompanionBehavior";

import type {
  CompanionPreferences,
  UpdateCompanionPreferences,
} from "./preferences";

export const DrawingCompanion = ({
  preferences,
  onPreferencesChange,
  suppressed = false,
}: {
  preferences: CompanionPreferences;
  onPreferencesChange: UpdateCompanionPreferences;
  suppressed?: boolean;
}): React.JSX.Element | null => {
  const app = useApp();
  const appState = useUIAppState();
  const { ui } = useAppProps();
  const defaultUIEnabled =
    ui !== false && (typeof ui !== "object" || ui === null);
  const editorInterface = useEditorInterface();
  const sidebarDocked = useAtomValue(isSidebarDockedAtom);
  const overwriteConfirm = useAtomValue(overwriteConfirmStateAtom);
  const sidebarDockedAndFits = !!(
    appState.openSidebar &&
    sidebarDocked &&
    editorInterface.canFitSidebar
  );
  const active =
    preferences.enabled &&
    editorInterface.formFactor !== "phone" &&
    defaultUIEnabled &&
    !appState.zenModeEnabled &&
    !appState.openDialog &&
    !appState.errorMessage &&
    !overwriteConfirm.active &&
    !suppressed &&
    (!appState.openSidebar || sidebarDockedAndFits);
  const { snapshot, reducedMotion, paused } = useCompanionBehavior({
    ownerDocument: app.ownerDocument,
    ownerWindow: app.ownerWindow,
    active,
    tipsEnabled: preferences.tipsEnabled,
  });
  if (!active) {
    return null;
  }
  return (
    <DrawingCompanionView
      snapshot={snapshot}
      reducedMotion={reducedMotion}
      paused={paused}
      tipsEnabled={preferences.tipsEnabled}
      onToggleTips={() =>
        onPreferencesChange({ tipsEnabled: !preferences.tipsEnabled })
      }
      onHide={() => {
        app.focusContainer();
        onPreferencesChange({ enabled: false });
      }}
    />
  );
};
