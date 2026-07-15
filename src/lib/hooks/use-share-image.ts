"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { toPng } from "html-to-image";

/**
 * Hook that provides a ref and a share handler for capturing a DOM element
 * as a PNG image and sharing/downloading it.
 *
 * Usage:
 * ```tsx
 * const { shareRef, handleShare, isSharing } = useShareAsImage(filename);
 * return (
 *   <>
 *     <div ref={shareRef}>{/* content to capture *\/}</div>
 *     <button onClick={handleShare} disabled={isSharing}>مشاركة</button>
 *   </>
 * );
 * ```
 */
export function useShareAsImage(filename = "hemma-result.png") {
  const shareRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!shareRef.current) return;
    setIsSharing(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      // Try Web Share API first (mobile-friendly)
      if (navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        await navigator.share({
          title: "منصة همّة التعليمية",
          text: "نتيجتي في اختبار القدرات",
          files: [file],
        });
      } else {
        // Fallback: download the image
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
        toast.success("تم حفظ الصورة بنجاح");
      }
    } catch (e) {
      // User cancelled share or error occurred
      if (e instanceof Error && e.name !== "AbortError") {
        console.error(e);
        toast.error("تعذّرت المشاركة. جرّب مرّة أخرى.");
      }
    } finally {
      setIsSharing(false);
    }
  }, [filename]);

  return { shareRef, handleShare, isSharing };
}
