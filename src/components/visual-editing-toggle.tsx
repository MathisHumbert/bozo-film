import { useIsPresentationTool } from "@sanity/visual-editing/react";
import { VisualEditingComponent } from "@sanity/astro/visual-editing/component";

export default function VisualEditingToggle() {
  const isPresentationTool = useIsPresentationTool();

  return (
    <>
      <VisualEditingComponent />

      {isPresentationTool === false && (
        <a
          href="/api/draft-mode/disable"
          data-no-swup
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: 2147483647,
            padding: "1rem 1.5rem",
            borderRadius: 0,
            background: "#101112",
            color: "#fff",
            fontSize: "1rem",
            textDecoration: "none",
          }}
        >
          Exit draft mode
        </a>
      )}
    </>
  );
}
