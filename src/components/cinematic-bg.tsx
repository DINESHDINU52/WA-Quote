'use client';

import React, { useEffect, useRef, useState } from 'react';

export function CinematicBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId: number;
    let isTransitioning = false;
    const maxOpacity = 0.35; // Premium cinematic opacity boundary

    // Main loop running on GPU frame sync
    const updateLoop = () => {
      if (video.duration && !isTransitioning) {
        const currentTime = video.currentTime;
        const duration = video.duration;
        const timeLeft = duration - currentTime;

        let targetOpacity = maxOpacity;

        // Smooth fade-in at loop start (0.5s)
        if (currentTime < 0.5) {
          targetOpacity = (currentTime / 0.5) * maxOpacity;
        }
        // Smooth fade-out at loop end (0.5s before duration)
        else if (timeLeft < 0.5) {
          targetOpacity = (timeLeft / 0.5) * maxOpacity;
        }

        // Apply opacity directly to the DOM for performance
        video.style.opacity = targetOpacity.toFixed(4);

        // Pre-emptively loop 50ms before physical end for perfect gapless play
        if (timeLeft <= 0.05 && !isTransitioning) {
          isTransitioning = true;
          video.style.opacity = '0';
          
          setTimeout(() => {
            video.currentTime = 0;
            video.play()
              .then(() => {
                isTransitioning = false;
              })
              .catch((err) => {
                console.log("Autoplay prevented:", err);
                isTransitioning = false;
              });
          }, 100);
        }
      }

      rafId = requestAnimationFrame(updateLoop);
    };

    // Standard ended callback fallback to capture any missed timings
    const handleEnded = () => {
      if (isTransitioning) return;
      isTransitioning = true;
      video.style.opacity = '0';

      setTimeout(() => {
        video.currentTime = 0;
        video.play()
          .then(() => {
            isTransitioning = false;
          })
          .catch((err) => {
            console.log("Ended loop play failed:", err);
            isTransitioning = false;
          });
      }, 100);
    };

    const handlePlay = () => setIsPlaying(true);

    video.addEventListener('play', handlePlay);
    video.addEventListener('ended', handleEnded);

    // Bootstrap playback
    video.play().catch((err) => {
      console.log("Initial autoplay triggered. Waiting for user engagement.", err);
    });

    rafId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden flex items-center justify-center font-sans-inter">
      
      {/* 1. Looping Cinematic Video Layer */}
      <video
        ref={videoRef}
        src="https://assets.mixkit.co/videos/preview/mixkit-bright-light-refractions-and-dust-particles-44445-large.mp4"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none transition-transform duration-1000 ease-out animate-slow-pan"
        muted
        playsInline
        autoPlay
        style={{ opacity: 0 }}
      />

      {/* 2. Soft Blur Haze & Radial Light Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/75 to-white/90 backdrop-blur-[2px] pointer-events-none z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.95)_75%)] pointer-events-none z-10" />

      {/* 3. Floating Ambient Blobs & blurred circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        
        {/* Soft glowing ambient circle 1 */}
        <div className="absolute top-[12%] left-[18%] h-96 w-96 rounded-full bg-slate-100/40 blur-[90px] animate-floating-glow" />
        
        {/* Soft glowing ambient circle 2 */}
        <div className="absolute bottom-[18%] right-[12%] h-[450px] w-[450px] rounded-full bg-slate-50/50 blur-[100px] animate-ambient-float" />
        
        {/* Modern technical floating circle 3 */}
        <div className="absolute top-[55%] left-[8%] h-[320px] w-[320px] rounded-full bg-gradient-to-tr from-slate-100/20 to-white/30 blur-[75px] animate-floating-glow [animation-delay:3s]" />
      </div>

      {/* 4. Fine-bordered Cinematic Floating Geometrics */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {/* Thin bordered luxury container float */}
        <div 
          className="absolute top-[22%] right-[25%] w-[320px] h-[200px] border border-slate-200/30 rounded-[30px] bg-white/[0.015] backdrop-blur-[1px] animate-ambient-float shadow-soft"
          style={{ animationDuration: '22s' }}
        />
        
        {/* Rotating modern invoice grids outline */}
        <div 
          className="absolute bottom-[22%] left-[22%] w-[260px] h-[260px] border border-slate-200/20 rounded-full animate-slow-rotate opacity-75"
        />
      </div>

      {/* 5. Slow-moving Light Dust Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        <div className="absolute top-[25%] left-[35%] w-1.5 h-1.5 rounded-full bg-slate-400/25 blur-[0.3px] animate-ambient-float" style={{ animationDuration: '19s' }} />
        <div className="absolute top-[52%] left-[65%] w-2 h-2 rounded-full bg-slate-300/20 blur-[0.8px] animate-ambient-float" style={{ animationDuration: '25s', animationDelay: '-5s' }} />
        <div className="absolute bottom-[28%] left-[45%] w-1 h-1 rounded-full bg-slate-400/30 blur-[0.3px] animate-ambient-float" style={{ animationDuration: '16s', animationDelay: '-9s' }} />
        <div className="absolute top-[38%] left-[12%] w-2.5 h-2.5 rounded-full bg-slate-300/15 blur-[1.2px] animate-ambient-float" style={{ animationDuration: '30s', animationDelay: '-14s' }} />
        <div className="absolute bottom-[18%] right-[28%] w-1.5 h-1.5 rounded-full bg-slate-400/20 blur-[0.5px] animate-ambient-float" style={{ animationDuration: '23s', animationDelay: '-3s' }} />
      </div>

      {/* 6. Center Cinematic Typography (No form/navbar) */}
      <div className="relative z-20 flex flex-col items-center text-center p-6 select-none max-w-2xl">
        {/* Fine sub-indicator badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/40 border border-slate-200/40 text-[9px] tracking-[0.28em] font-sans-inter font-medium text-slate-400 uppercase backdrop-blur-md shadow-soft animate-fade-in-soft mb-8">
          <span className="h-1 w-1 rounded-full bg-slate-400 animate-pulse" />
          <span>Cinematic Enterprise System</span>
        </div>

        {/* Master Branding Title in Instrument Serif */}
        <h1 className="font-serif-cinematic text-7xl sm:text-[92px] font-light text-slate-800 tracking-tight leading-[0.9] animate-fade-in-soft">
          The Art of <span className="italic text-slate-500 font-light">Billing</span>
        </h1>

        {/* Luxury narrative supporting copy in Inter */}
        <p className="mt-6 font-sans-inter text-[13px] tracking-[0.03em] font-light text-slate-400 max-w-sm leading-relaxed animate-fade-in-soft [animation-delay:0.35s]">
          A clean, light-themed luxury fintech workspace designed for enterprise invoicing workflows, secure quotation lifecycle handling, and billing administration.
        </p>

        {/* Exquisite bottom coordinate line decoration */}
        <div className="mt-12 flex items-center gap-4 w-44 animate-fade-in-soft [animation-delay:0.65s]">
          <span className="h-[0.5px] flex-1 bg-slate-300/40" />
          <span className="text-[9px] font-sans-inter tracking-[0.35em] text-slate-400 font-bold uppercase">CHN</span>
          <span className="h-[0.5px] flex-1 bg-slate-300/40" />
        </div>
      </div>

    </div>
  );
}
