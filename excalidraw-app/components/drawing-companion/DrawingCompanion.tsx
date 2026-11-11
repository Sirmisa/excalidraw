import { useEffect, useRef, useState } from "react";

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
  const watchModals =
    preferences.enabled &&
    editorInterface.formFactor !== "phone" &&
    defaultUIEnabled &&
    !appState.zenModeEnabled &&
    !suppressed;
  const ownerDocument = app.ownerDocument;
  const ownerWindow = app.ownerWindow;
  const [modalOpen, setModalOpen] = useState(false);
  const modalOpenRef = useRef(false);
  useEffect(() => {
    if (!watchModals) {
      modalOpenRef.current = false;
      setModalOpen(false);
      return;
    }
    // Library and confirmation dialogs also own local state. Their portals
    // block this owning document, even when they do not set openDialog.
    // Target Modal portals; closed color pickers also keep aria-modal markup.
    const checkModals = () => {
      const next = !!ownerDocument.querySelector(
        '.excalidraw-modal-container .Modal[aria-modal="true"]',
      );
      if (modalOpenRef.current !== next) {
        modalOpenRef.current = next;
        setModalOpen(next);
      }
    };
    const observer = new ownerWindow.MutationObserver(checkModals);
    observer.observe(ownerDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    checkModals();
    return () => observer.disconnect();
  }, [ownerDocument, ownerWindow, watchModals]);
  const active =
    preferences.enabled &&
    editorInterface.formFactor !== "phone" &&
    defaultUIEnabled &&
    !appState.zenModeEnabled &&
    !appState.openDialog &&
    !appState.errorMessage &&
    !overwriteConfirm.active &&
    !modalOpen &&
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
