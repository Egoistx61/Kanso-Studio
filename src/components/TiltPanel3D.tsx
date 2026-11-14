import { useRef, type ReactNode } from 'react';

interface TiltPanel3DProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  onClick?: () => void;
  asButton?: boolean;
}

/**
 * GPU-composited 3D cursor-reactive panel with dynamic black shadow projection.
 * Updates transforms via requestAnimationFrame directly on DOM refs for 120fps
 * performance with zero React re-renders during mouse movement.
 */
export function TiltPanel3D({
  children,
  className = '',
  maxTilt = 8,
  onClick,
  asButton = false,
}: TiltPanel3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    targetRx: 0,
    targetRy: 0,
    currentRx: 0,
    currentRy: 0,
    glareX: 50,
    glareY: 50,
    hovering: false,
    rafId: 0,
  });

  const startLoop = () => {
    const st = stateRef.current;
    if (st.rafId) return;

    const step = () => {
      const card = cardRef.current;
      if (!card) {
        st.rafId = 0;
        return;
      }

      st.currentRx += (st.targetRx - st.currentRx) * 0.16;
      st.currentRy += (st.targetRy - st.currentRy) * 0.16;

      const settled =
        !st.hovering &&
        Math.abs(st.currentRx) < 0.03 &&
        Math.abs(st.currentRy) < 0.03;

      if (settled) {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        card.style.boxShadow = '';
        if (sheenRef.current) sheenRef.current.style.opacity = '0';
        st.rafId = 0;
        return;
      }

      const lift = st.hovering ? 10 : 0;
      card.style.transform = `perspective(1000px) rotateX(${st.currentRx.toFixed(2)}deg) rotateY(${st.currentRy.toFixed(2)}deg) translateZ(${lift}px)`;

      // Dynamic black shadow shifts opposite the tilt angle for tactile physical depth
      const shadowX = (-st.currentRy * 1.4).toFixed(1);
      const shadowY = (14 + st.currentRx * 1.4).toFixed(1);
      card.style.boxShadow = `${shadowX}px ${shadowY}px 34px -8px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.12)`;

      if (sheenRef.current) {
        sheenRef.current.style.opacity = st.hovering ? '1' : '0';
        sheenRef.current.style.background = `radial-gradient(circle at ${st.glareX}% ${st.glareY}%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 62%)`;
      }

      st.rafId = requestAnimationFrame(step);
    };

    st.rafId = requestAnimationFrame(step);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const st = stateRef.current;
    st.hovering = true;
    st.targetRy = (px - 0.5) * 2 * maxTilt;
    st.targetRx = (0.5 - py) * 2 * maxTilt;
    st.glareX = Math.round(px * 100);
    st.glareY = Math.round(py * 100);
    startLoop();
  };

  const handleMouseLeave = () => {
    const st = stateRef.current;
    st.hovering = false;
    st.targetRx = 0;
    st.targetRy = 0;
    startLoop();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={cardRef}
      data-cursor={onClick ? 'interactive' : '3d'}
      role={asButton || onClick ? 'button' : undefined}
      tabIndex={asButton || onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-colors duration-150 will-change-transform transform-gpu ${className}`}
    >
      <div
        ref={sheenRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-200"
      />
      {children}
    </div>
  );
}
