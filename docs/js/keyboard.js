// Global keyboard controls, matching the design prototype's componentDidMount
// listeners: arrow keys cycle live views, Enter is context-sensitive per phase.
// Arrow keys are suppressed while a form field is focused (isTyping) -- the
// live phase's score inputs need ←/→ to move the caret and ↑/↓ for their
// native number-spinner nudge, so those can't also mean "switch view" while
// typing in one. Enter is left alone even while typing: ending the round
// after entering the last score is an intentional, existing shortcut.

export function bindKeyboard(controller) {
  window.addEventListener("keydown", (e) => {
    const isTyping = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");

    if (controller.isModalOpen && controller.isModalOpen()) {
      if (e.key === "Escape") controller.closeModal();
      return; // block round/view hotkeys while the player popup is open
    }
    if (controller.getPhase() === "live") {
      if (controller.isConfirmPending && controller.isConfirmPending()) {
        // On the confirm step: Enter registers the round, ←/Escape backs out
        // without applying anything. Everything else (including →) is ignored --
        // this step isn't part of the normal view cycle. No score inputs are
        // shown here, so no typing guard is needed on this branch.
        if (e.key === "Enter") controller.confirmRoundEnd();
        else if (e.key === "ArrowLeft" || e.key === "Escape") controller.cancelRoundEnd();
        return;
      }
      if (!isTyping) {
        if (e.key === "ArrowRight") { controller.cycleView(1); return; }
        if (e.key === "ArrowLeft") { controller.cycleView(-1); return; }
      }
      if (e.key === "Enter") { controller.requestRoundEnd(); return; }
      return;
    }
    if (controller.getPhase() === "finale" && e.key === "Enter") {
      controller.advanceFinale();
    }
  });
}
