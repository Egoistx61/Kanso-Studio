import { useEffect, useRef } from 'react';

interface CodingCursorProps {
  enabled: boolean;
}

type CursorMode = 'default' | 'interactive' | 'code' | '3d';

export function CodingCursor({ enabled }: CodingCursorProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const leftBracketRef = useRef<HTMLSpanElement>(null);
  const rightBracketRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!enabled || !isFinePointer || prefersReduced) {
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    document.documentElement.classList.add('custom-cursor-active');

    let mouseX = -100;
    let mouseY = -100;
    let frameX = -100;
    let frameY = -100;
    let visible = false;
    let pressed = false;
    let mode: CursorMode = 'default';
    let rafId = 0;

    const applyModeStyles = (nextMode: CursorMode) => {
      const left = leftBracketRef.current;
      const right = rightBracketRef.current;
      const dot = dotRef.current;
      const caret = caretRef.current;
      const badge = badgeRef.current;
      const frame = frameRef.current;
      if (!left || !right || !dot || !caret || !badge || !frame) return;

      if (nextMode === 'code') {
        left.style.opacity = '0';
        right.style.opacity = '0';
        dot.style.opacity = '0';
        caret.style.opacity = '1';
        badge.style.opacity = '0';
        frame.style.gap = '0px';
      } else if (nextMode === 'interactive') {
        left.textContent = '{';
        right.textContent = '}';
        left.style.opacity = '1';
        right.style.opacity = '1';
        dot.style.opacity = '1';
        dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) scale(1.35)`;
        caret.style.opacity = '0';
        badge.style.opacity = '0';
        frame.style.gap = '18px';
      } else if (nextMode === '3d') {
        left.textContent = '[';
        right.textContent = ']';
        left.style.opacity = '1';
        right.style.opacity = '1';
        dot.style.opacity = '1';
        caret.style.opacity = '0';
        badge.textContent = '3D';
        badge.style.opacity = '1';
        frame.style.gap = '24px';
      } else {
        left.textContent = '<';
        right.textContent = '>';
        left.style.opacity = '1';
        right.style.opacity = '1';
        dot.style.opacity = '1';
        caret.style.opacity = '0';
        badge.style.opacity = '0';
        frame.style.gap = '12px';
      }
    };

    const resolveMode = (target: EventTarget | null): CursorMode => {
      if (!(target instanceof Element)) return 'default';
      if (target.closest('[data-cursor="code"], textarea.code-input')) return 'code';
      if (target.closest('button, a, input, select, [role="button"], [data-cursor="interactive"]')) {
        return 'interactive';
      }
      if (target.closest('[data-cursor="3d"]')) return '3d';
      return 'default';
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) {
        visible = true;
        frameX = mouseX;
        frameY = mouseY;
        if (dotRef.current) dotRef.current.style.opacity = mode === 'code' ? '0' : '1';
        if (frameRef.current) frameRef.current.style.opacity = '1';
      }
      const nextMode = resolveMode(e.target);
      if (nextMode !== mode) {
        mode = nextMode;
        applyModeStyles(mode);
      }
    };

    const onMouseDown = () => {
      pressed = true;
      if (pulseRef.current) {
        pulseRef.current.style.transition = 'none';
        pulseRef.current.style.opacity = '0.5';
        pulseRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%) scale(0.5)`;
        requestAnimationFrame(() => {
          if (!pulseRef.current) return;
          pulseRef.current.style.transition = 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms ease';
          pulseRef.current.style.opacity = '0';
          pulseRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%) scale(1.9)`;
        });
      }
    };

    const onMouseUp = () => {
      pressed = false;
    };

    const onMouseLeave = () => {
      visible = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (frameRef.current) frameRef.current.style.opacity = '0';
    };

    const tick = () => {
      // Smooth damped interpolation for brackets, zero-lag instant tracking for dot & caret
      frameX += (mouseX - frameX) * 0.28;
      frameY += (mouseY - frameY) * 0.28;

      const scale = pressed ? 0.84 : 1;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%) scale(${mode === 'interactive' ? 1.3 : 1})`;
      }
      if (caretRef.current) {
        caretRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
      if (frameRef.current) {
        frameRef.current.style.transform = `translate3d(${frameX}px, ${frameY}px, 0) translate(-50%, -50%) scale(${scale})`;
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    applyModeStyles('default');
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] hidden [@media(pointer:fine)]:block"
    >
      {/* Zero-lag central pixel reticle */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 h-1.5 w-1.5 rounded-[1px] bg-zinc-950 dark:bg-zinc-50 opacity-0 transition-opacity duration-100 will-change-transform"
      />

      {/* Precision I-beam caret inside coding area */}
      <div
        ref={caretRef}
        className="fixed top-0 left-0 h-5 w-[2px] bg-zinc-950 dark:bg-zinc-50 opacity-0 transition-opacity duration-100 will-change-transform"
      />

      {/* Click pulse ring */}
      <div
        ref={pulseRef}
        className="fixed top-0 left-0 h-6 w-6 rounded-full border border-zinc-950 dark:border-zinc-50 opacity-0 will-change-transform"
      />

      {/* Smooth trailing coding brackets < > / { } / [ 3D ] */}
      <div
        ref={frameRef}
        className="fixed top-0 left-0 flex items-center justify-center opacity-0 transition-[gap] duration-150 ease-out will-change-transform select-none"
        style={{ gap: '12px' }}
      >
        <span
          ref={leftBracketRef}
          className="font-mono text-[13px] font-semibold leading-none text-zinc-950 dark:text-zinc-50 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]"
        >
          &lt;
        </span>
        <span
          ref={badgeRef}
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] font-semibold tracking-wider text-zinc-700 dark:text-zinc-300 opacity-0 transition-opacity duration-150"
        >
          3D
        </span>
        <span
          ref={rightBracketRef}
          className="font-mono text-[13px] font-semibold leading-none text-zinc-950 dark:text-zinc-50 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]"
        >
          &gt;
        </span>
      </div>
    </div>
  );
}
