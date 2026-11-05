import {
  useApp,
  useExcalidrawContainer,
} from "@excalidraw/excalidraw/components/App";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useLayoutEffect, useState } from "react";

import { CompanionArtwork } from "./CompanionArtwork";
import { useCompanionRoutines } from "./useCompanionRoutines";
import {
  COMPANION_BUBBLE_HEIGHT,
  COMPANION_BUBBLE_WIDTH,
  useCompanionPlacement,
} from "./useCompanionPlacement";

import "./Companion.scss";

export const Companion = ({
  enabled,
  onHide,
}: {
  enabled: boolean;
  onHide: () => void;
}) => {
  const app = useApp();
  const { container } = useExcalidrawContainer();
  const { t } = useI18n();
  const { isLoading, zenModeEnabled, viewModeEnabled, openDialog } =
    useUIAppState();
  // Resolve owning browser preferences before revealing the first pose.
  const [documentHidden, setDocumentHidden] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useLayoutEffect(() => {
    const ownerDocument = app.ownerDocument;
    // Application dialogs and imperative confirmations also use this owned
    // portal container, without necessarily setting the editor's openDialog.
    const updateModal = () =>
      setModalOpen(
        !!ownerDocument.body.querySelector(
          '.excalidraw-modal-container [role="dialog"][aria-modal="true"]',
        ),
      );
    const observer = new app.ownerWindow.MutationObserver(updateModal);
    observer.observe(ownerDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    updateModal();
    return () => observer.disconnect();
  }, [app]);

  useLayoutEffect(() => {
    const motionQuery = app.ownerWindow.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const onMotionChange = () => setReducedMotion(motionQuery.matches);
    onMotionChange();
    motionQuery.addEventListener("change", onMotionChange);
    return () => motionQuery.removeEventListener("change", onMotionChange);
  }, [app]);

  useLayoutEffect(() => {
    const ownerDocument = app.ownerDocument;
    const onVisibilityChange = () => setDocumentHidden(ownerDocument.hidden);
    onVisibilityChange();
    ownerDocument.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      ownerDocument.removeEventListener("visibilitychange", onVisibilityChange);
  }, [app]);

  const active = !(
    !enabled ||
    documentHidden ||
    isLoading ||
    zenModeEnabled ||
    viewModeEnabled ||
    openDialog ||
    modalOpen
  );
  const placement = useCompanionPlacement(active);
  const { routine, text } = useCompanionRoutines(
    app,
    active && !!placement,
    reducedMotion,
  );

  if (!active || !placement) {
    return null;
  }

  return (
    <div className="companion" style={placement}>
      {text && (
        <div
          className="companion__bubble"
          style={{
            width: COMPANION_BUBBLE_WIDTH,
            maxHeight: COMPANION_BUBBLE_HEIGHT,
          }}
        >
          {t(text)}
        </div>
      )}
      <div role="img" aria-label={t("companion.description")}>
        <CompanionArtwork reducedMotion={reducedMotion} routine={routine} />
      </div>
      <button
        type="button"
        className="companion__hide"
        aria-label={t("companion.hide")}
        onClick={(event) => {
          const restoreFocus =
            app.ownerDocument.activeElement === event.currentTarget;
          onHide();
          if (restoreFocus) {
            container
              ?.querySelector<HTMLButtonElement>(".main-menu-trigger")
              ?.focus();
          }
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
};
