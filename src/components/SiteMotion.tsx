"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Animate meaningful groups, leaving long-form text and form controls still.
const TARGETS = [
  ".hero__badge", ".hero__title", ".hero__lead", ".theme-art",
  ".input-workspace", ".result-overview", ".travel-list__title", ".travel-item",
  ".ranking__title", ".ranking-table tbody tr", ".ranking-mobile > li",
  ".meeting-points", ".nearby-spots", ".result-service", ".foot",
  ".member-page__intro", ".member-page > .panel", ".member-page__columns > .panel",
  ".member-library__list > li", ".member-collaboration",
  ".howto-header", ".howto-tour", ".howto-start", ".not-found-card",
  ".history__panel", ".qr-panel", ".nearby-spots__content", ".meeting-journey",
].join(",");

/** One entrance per element and visit. Content never depends on motion to be visible. */
export function SiteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.IntersectionObserver || !Element.prototype.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new Set<HTMLElement>();
    const animations = new Set<Animation>();

    const reveal = (element: HTMLElement, order = 0) => {
      if (element.dataset.motion === "visible") return;
      element.dataset.motion = "visible";
      if (preference.matches || element.contains(document.activeElement)) return;
      const artwork = element.classList.contains("theme-art");
      const heading = element.classList.contains("hero__title");
      const frames: Keyframe[] = artwork
        ? [{ opacity: 0, translate: "0 16px", rotate: "-12deg", scale: 0.9 }, { opacity: 1, translate: "0 0", rotate: "0deg", scale: 1 }]
        : heading
          ? [{ opacity: 0, translate: "0 20px", clipPath: "inset(0 0 100% 0)" }, { opacity: 1, translate: "0 0", clipPath: "inset(0 0 0% 0)" }]
          : [{ opacity: 0, translate: "0 20px" }, { opacity: 1, translate: "0 0" }];
      const animation = element.animate(frames, {
        duration: artwork ? 800 : 600,
        delay: Math.min(order, 4) * 65,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "backwards",
      });
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    };

    const observer = new IntersectionObserver((entries) => {
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target as HTMLElement, order++);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

    const watch = (element: HTMLElement) => {
      if (seen.has(element) || !element.getClientRects().length) return;
      seen.add(element);
      if (preference.matches) element.dataset.motion = "visible";
      else observer.observe(element);
    };
    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(TARGETS)) watch(root);
      root.querySelectorAll<HTMLElement>(TARGETS).forEach(watch);
    };
    scan(document);
    // Search results, histories and account data can arrive after navigation.
    const changes = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") scan(record.target as HTMLElement);
        else record.addedNodes.forEach((node) => { if (node instanceof HTMLElement) scan(node); });
      }
    });
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });

    const cancelAnimations = () => {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const stop = () => {
      if (!preference.matches) return;
      cancelAnimations();
      observer.disconnect();
      seen.forEach((element) => { element.dataset.motion = "visible"; });
    };
    preference.addEventListener("change", stop);
    window.addEventListener("beforeprint", cancelAnimations);
    return () => {
      observer.disconnect();
      changes.disconnect();
      preference.removeEventListener("change", stop);
      window.removeEventListener("beforeprint", cancelAnimations);
      cancelAnimations();
      seen.forEach((element) => { delete element.dataset.motion; });
    };
  }, [pathname]);

  return null;
}
