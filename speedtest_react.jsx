const { useState, useEffect, useRef, useCallback } = React;

function useSpeedTest() {
  const [ping, setPing] = useState('--');
  const [download, setDownload] = useState('--');
  const [upload, setUpload] = useState('--');
  const [liveUnit, setLiveUnit] = useState('Mbps');
  const [statusText, setStatusText] = useState('Ready');
  const [activeCard, setActiveCard] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const targetSpeedRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const abortRef = useRef(false);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const simulatePhase = useCallback((peakValue, durationMs) => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      let rafId = null;
      const update = () => {
        if (abortRef.current) { resolve(); return; }
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        const ramp = Math.sin((progress * Math.PI) / 2);
        const fluctuation = (Math.random() - 0.5) * (peakValue * 0.12);
        targetSpeedRef.current = Math.max(0, (peakValue * ramp) + fluctuation);
        if (progress < 1) {
          rafId = requestAnimationFrame(update);
        } else {
          targetSpeedRef.current = peakValue;
          resolve();
        }
      };
      rafId = requestAnimationFrame(update);
      return () => { if (rafId) cancelAnimationFrame(rafId); };
    });
  }, []);

  const startTest = useCallback(async () => {
    if (isTesting) return;
    setIsTesting(true);
    abortRef.current = false;

    setPing('--');
    setDownload('--');
    setUpload('--');

    setActiveCard('ping');
    setStatusText('Testing Ping...');
    setLiveUnit('ms');
    await simulatePhase(15, 1200);
    const finalPing = Math.floor(Math.random() * (16 - 8 + 1)) + 8;
    setPing(finalPing);
    setActiveCard(null);
    targetSpeedRef.current = 0;
    await sleep(500);
    if (abortRef.current) { setIsTesting(false); return; }

    setActiveCard('download');
    setStatusText('Testing Download Speed...');
    setLiveUnit('Mbps');
    const simDownload = Math.floor(Math.random() * (450 - 300)) + 300;
    await simulatePhase(simDownload, 5000);
    setDownload(targetSpeedRef.current.toFixed(1));
    setActiveCard(null);
    targetSpeedRef.current = 0;
    await sleep(600);
    if (abortRef.current) { setIsTesting(false); return; }

    setActiveCard('upload');
    setStatusText('Testing Upload Speed...');
    const simUpload = Math.floor(Math.random() * (180 - 120)) + 120;
    await simulatePhase(simUpload, 5000);
    setUpload(targetSpeedRef.current.toFixed(1));
    setActiveCard(null);

    targetSpeedRef.current = 0;
    setStatusText('Test Completed');
    setIsTesting(false);
  }, [isTesting, simulatePhase]);

  const cancelTest = useCallback(() => {
    abortRef.current = true;
    setIsTesting(false);
    setStatusText('Cancelled');
  }, []);

  return {
    ping, download, upload, liveUnit, statusText, activeCard, isTesting,
    targetSpeedRef, currentSpeedRef,
    startTest, cancelTest
  };
}

function SpeedTest() {
  const {
    ping, download, upload, liveUnit, statusText, activeCard, isTesting,
    targetSpeedRef, currentSpeedRef,
    startTest, cancelTest
  } = useSpeedTest();

  const canvasRef = useRef(null);
  const liveSpeedRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const size = Math.min(w, 300);
      setCanvasSize({ width: size, height: size });
    };
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    updateSize();
    return () => ro.disconnect();
  }, []);

  // Gauge drawing (same, but colors adjusted for dark background)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId = null;

    const render = () => {
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * 0.08;

      const { width, height } = canvas;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;
      const startAngle = 0.75 * Math.PI;
      const endAngle = 2.25 * Math.PI;
      const totalAngle = endAngle - startAngle;
      const maxGaugeSpeed = 1000;

      ctx.clearRect(0, 0, width, height);

      // Scale ticks
      ctx.save();
      ctx.font = '12px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff'; // white for dark bg
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      for (let v = 0; v <= maxGaugeSpeed; v += 100) {
        const fraction = v / maxGaugeSpeed;
        const angle = startAngle + fraction * totalAngle;
        const innerR = radius - 4;
        const outerR = radius + 12;
        ctx.beginPath();
        ctx.moveTo(centerX + innerR * Math.cos(angle), centerY + innerR * Math.sin(angle));
        ctx.lineTo(centerX + outerR * Math.cos(angle), centerY + outerR * Math.sin(angle));
        ctx.stroke();
        const textR = radius + 26;
        ctx.fillText(v.toString(), centerX + textR * Math.cos(angle), centerY + textR * Math.sin(angle));
      }
      // Minor ticks
      for (let v = 50; v < maxGaugeSpeed; v += 50) {
        if (v % 100 === 0) continue;
        const fraction = v / maxGaugeSpeed;
        const angle = startAngle + fraction * totalAngle;
        ctx.beginPath();
        ctx.moveTo(centerX + (radius - 2) * Math.cos(angle), centerY + (radius - 2) * Math.sin(angle));
        ctx.lineTo(centerX + (radius + 6) * Math.cos(angle), centerY + (radius + 6) * Math.sin(angle));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Track
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glowing arc
      const currentAngle = startAngle + (Math.min(currentSpeedRef.current, maxGaugeSpeed) / maxGaugeSpeed) * totalAngle;
      if (currentAngle > startAngle) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, currentAngle);
        ctx.lineWidth = 14;
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#A6C8FF');
        grad.addColorStop(0.5, '#5227FF');
        grad.addColorStop(1, '#FF9FFC');
        ctx.strokeStyle = grad;
        const glow = 15 + 8 * Math.sin(Date.now() / 1000);
        ctx.shadowColor = '#FF9FFC';
        ctx.shadowBlur = glow;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Needle
      const needleAngle = startAngle + (Math.min(currentSpeedRef.current, maxGaugeSpeed) / maxGaugeSpeed) * totalAngle;
      const needleLength = radius - 28;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(needleAngle) * needleLength, centerY + Math.sin(needleAngle) * needleLength);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff'; // white needle
      ctx.shadowColor = '#FF9FFC';
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Cap
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF9FFC';
      ctx.shadowColor = '#FF9FFC';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (liveSpeedRef.current) {
        liveSpeedRef.current.textContent = currentSpeedRef.current.toFixed(1);
      }

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => { if (frameId) cancelAnimationFrame(frameId); };
  }, [currentSpeedRef, targetSpeedRef, canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
  }, [canvasSize]);

  const textPrimary = '#ffffff';
  const textSecondary = '#cfd8ee';
  const accent = '#ff5e14';
  const glow = '#00e0c7';

  const WifiIcon = () => (
    <svg viewBox="0 0 24 24" width="2.8rem" height="2.8rem" fill="none" stroke={textPrimary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginLeft: '0.6rem' }}>
      <path d="M5 12.55a10.94 10.94 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.94 0" />
      <circle cx="12" cy="20" r="1.2" fill={textPrimary} stroke="none" />
    </svg>
  );

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 10px',
      color: textPrimary,
      minHeight: '450px',
    }}>
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '600px',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2.2rem', fontWeight: 900, color: textPrimary, textShadow: '0 0 20px rgba(0,224,199,0.3)', margin: 0 }}>SHAN ZONE</h1>
          <WifiIcon />
        </div>
        <p style={{ fontSize: '0.85rem', color: textSecondary, letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '-0.2rem' }}>High-Speed Network Diagnostic</p>

        {/* Cards */}
        <div style={{ display: 'flex', gap: '15px', width: '100%', maxWidth: '500px', margin: '20px 0' }}>
          {[
            { key: 'ping', label: 'PING', value: ping, unit: 'ms' },
            { key: 'download', label: 'DOWNLOAD', value: download, unit: 'Mbps' },
            { key: 'upload', label: 'UPLOAD', value: upload, unit: 'Mbps' },
          ].map((item) => {
            const isActive = activeCard === item.key;
            return (
              <div key={item.key} style={{
                flex: 1,
                background: isActive ? 'rgba(0,224,199,0.25)' : 'rgba(255,255,255,0.1)',
                border: isActive ? `2px solid ${glow}` : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '16px',
                padding: '14px 6px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ fontSize: '0.75rem', color: textSecondary, fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.4rem', color: textPrimary }}>
                  {item.value}
                  <span style={{ fontSize: '0.7rem', color: accent, fontWeight: 700 }}> {item.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gauge */}
        <div ref={containerRef} style={{
          position: 'relative',
          width: '100%',
          maxWidth: '300px',
          aspectRatio: '1 / 1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', width: '100%', height: '100%', display: 'block' }} />
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div ref={liveSpeedRef} style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '3rem', fontWeight: 900, color: textPrimary, textShadow: '0 0 20px rgba(0,224,199,0.2)' }}>0.0</div>
            <div style={{ fontSize: '0.85rem', color: accent, fontWeight: 700 }}>{liveUnit}</div>
            <div style={{ fontSize: '0.8rem', color: textSecondary, marginTop: '8px', fontWeight: 600 }}>{statusText}</div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={startTest} disabled={isTesting} className="glossy-btn" style={{
            padding: '14px 45px',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            color: '#fff',
            background: isTesting ? 'linear-gradient(135deg, #888, #aaa)' : `linear-gradient(135deg, ${accent}, ${glow})`,
            border: 'none',
            borderRadius: '50px',
            cursor: isTesting ? 'not-allowed' : 'pointer',
            boxShadow: isTesting ? 'none' : '0 0 30px rgba(0,224,199,0.6)',
            textShadow: '0 0 10px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.3s',
            transform: isTesting ? 'scale(0.98)' : 'scale(1)',
          }}>
            {isTesting ? 'TESTING...' : 'START TEST'}
          </button>
          {isTesting && (
            <button onClick={cancelTest} style={{
              padding: '14px 26px',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              color: '#fff',
              background: 'rgba(200, 50, 50, 0.7)',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}>
              CANCEL
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: textSecondary, opacity: 0.8, fontWeight: 600, marginTop: '15px' }}>
          Powered by SHAN ZONE Core Network
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('react-speedtest-root')).render(<SpeedTest />);
