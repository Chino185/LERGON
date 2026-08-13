import React, { useEffect, useRef, useState } from 'react';

interface LandingPageBackgroundProps {
  currentBg?: string;
  onToggleBg?: (bg: any) => void;
  isDarkMode?: boolean;
}

const TOTAL_FRAMES = 300;

export const LandingPageBackground: React.FC<LandingPageBackgroundProps> = ({ isDarkMode: externalDarkMode }) => {
  const canvasLightRef = useRef<HTMLCanvasElement>(null);
  const canvasDarkRef = useRef<HTMLCanvasElement>(null);

  const lightImagesRef = useRef<HTMLImageElement[]>([]);
  const darkImagesRef = useRef<HTMLImageElement[]>([]);

  const currentFrameRef = useRef<number>(0);
  const targetFrameRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastDrawnFrameRef = useRef<number>(-1);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof externalDarkMode === 'boolean') return externalDarkMode;
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  // Theme observer to catch darkmode toggle changes dynamically
  useEffect(() => {
    if (typeof externalDarkMode === 'boolean') {
      setIsDark(externalDarkMode);
      return;
    }

    const updateThemeState = () => {
      const darkActive = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDark(darkActive);
    };

    updateThemeState();

    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => observer.disconnect();
  }, [externalDarkMode]);

  // Clean, reliable image frame loading
  useEffect(() => {
    let isMounted = true;
    const lightImages: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    const darkImages: HTMLImageElement[] = new Array(TOTAL_FRAMES);

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const frameNum = String(i).padStart(3, '0');

      const imgLight = new Image();
      imgLight.src = `/frames_light/ezgif-frame-${frameNum}.jpg`;
      imgLight.onload = () => {
        if (isMounted && i === 1 && canvasLightRef.current) {
          drawSingleCanvas(canvasLightRef.current, 0, lightImages);
        }
      };
      lightImages[i - 1] = imgLight;

      const imgDark = new Image();
      imgDark.src = `/frames_dark/ezgif-frame-${frameNum}.jpg`;
      imgDark.onload = () => {
        if (isMounted && i === 1 && canvasDarkRef.current) {
          drawSingleCanvas(canvasDarkRef.current, 0, darkImages);
        }
      };
      darkImages[i - 1] = imgDark;
    }

    lightImagesRef.current = lightImages;
    darkImagesRef.current = darkImages;

    return () => {
      isMounted = false;
    };
  }, []);

  const drawSingleCanvas = (canvas: HTMLCanvasElement | null, frameIndex: number, imagesArray: HTMLImageElement[]) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let img = imagesArray[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = imagesArray[frameIndex - offset];
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev;
          break;
        }
        const next = imagesArray[frameIndex + offset];
        if (next && next.complete && next.naturalWidth > 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const scale = Math.max(cw / iw, ch / ih);
    const x = (cw - iw * scale) / 2;
    const y = (ch - ih * scale) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, iw * scale, ih * scale);
  };

  const drawFrames = (frameIndex: number) => {
    drawSingleCanvas(canvasLightRef.current, frameIndex, lightImagesRef.current);
    drawSingleCanvas(canvasDarkRef.current, frameIndex, darkImagesRef.current);
    lastDrawnFrameRef.current = frameIndex;
  };

  useEffect(() => {
    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      [canvasLightRef.current, canvasDarkRef.current].forEach(canvas => {
        if (canvas) {
          canvas.width = window.innerWidth * dpr;
          canvas.height = window.innerHeight * dpr;
        }
      });

      const currentIdx = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrameRef.current)));
      drawFrames(currentIdx);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loop = () => {
      const diff = targetFrameRef.current - currentFrameRef.current;
      if (Math.abs(diff) > 0.001) {
        currentFrameRef.current += diff * 0.15;
      } else {
        currentFrameRef.current = targetFrameRef.current;
      }

      const frameIdx = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentFrameRef.current)));
      if (frameIdx !== lastDrawnFrameRef.current) {
        drawFrames(frameIdx);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const progress = Math.min(1, Math.max(0, window.scrollY / docHeight));
        targetFrameRef.current = progress * (TOTAL_FRAMES - 1);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0 transition-colors duration-700 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Light Mode Canvas Layer */}
      <canvas
        ref={canvasLightRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out brightness-[1.12] contrast-[1.02] ${isDark ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Dark Mode Canvas Layer */}
      <canvas
        ref={canvasDarkRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${isDark ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
