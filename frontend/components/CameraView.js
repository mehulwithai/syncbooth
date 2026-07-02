'use client';
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const CameraView = forwardRef(function CameraView({ stream, mirrored = false, placeholderText = 'Camera offline' }, ref) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  useImperativeHandle(ref, () => ({
    capture() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !stream) return null;
      
      // Capture at video's native resolution or default fallback
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      const ctx = canvas.getContext('2d');
      
      if (mirrored) {
        // mirror for a natural selfie-style capture
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
  }));

  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={mirrored} // Mute local preview (though audio is not requested)
          className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-6 gap-3 animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 relative">
            <span className="text-2xl animate-pulse">📷</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
            </span>
          </div>
          <p className="text-white/40 text-xs tracking-wider uppercase">{placeholderText}</p>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
});

export default CameraView;
