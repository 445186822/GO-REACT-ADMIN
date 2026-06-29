import { ReloadOutlined, SwapRightOutlined } from '@ant-design/icons';
import { Button, Spin, Typography } from 'antd';
import type { PointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptchaChallenge } from '../../api/auth';
import { getCaptchaChallengeApi, verifyCaptchaApi } from '../../api/auth';
import { clampSliderX, sliderProgressWidth, toTrackPoint, type SliderTrackPoint } from './sliderCaptchaUtils';

type SliderCaptchaProps = {
  enabled: boolean;
  onVerified: (token: string) => void;
};

export function SliderCaptcha({ enabled, onVerified }: SliderCaptchaProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [stageWidth, setStageWidth] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef({
    dragging: false,
    startClientX: 0,
    startOffset: 0,
    startTime: 0,
    track: [] as SliderTrackPoint[],
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Measure actual stage width so the piece matches the scaled background.
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => setStageWidth(el.clientWidth);
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [challenge]);

  // Scale factor: challenge images are designed for 280x120 stage.
  const scale = challenge ? stageWidth / challenge.width : 1;
  const stageHeight = challenge ? Math.round(stageWidth * challenge.height / challenge.width) : 120;
  const pieceDisplaySize = Math.round(challenge ? challenge.piece_size * scale : 44);

  const resetOffset = (next = 0) => {
    setOffset(next);
    dragRef.current.track = [];
  };

  const resetCaptchaState = useCallback(() => {
    setChallenge(null);
    setVerified(false);
    setError('');
    resetOffset(0);
    onVerified('');
  }, [onVerified]);

  const loadChallenge = useCallback(async () => {
    if (!enabled) {
      resetCaptchaState();
      return;
    }

    setLoading(true);
    setError('');
    setVerified(false);
    onVerified('');

    try {
      const data = await getCaptchaChallengeApi();
      if (!mountedRef.current) return;
      setChallenge(data);
      resetOffset(data.initial_x);
    } catch {
      if (!mountedRef.current) return;
      setError('验证图片加载失败，请刷新重试');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, onVerified, resetCaptchaState]);

  useEffect(() => {
    if (!enabled) {
      resetCaptchaState();
      return;
    }
    void loadChallenge();
  }, [enabled, loadChallenge, resetCaptchaState]);

  // offset is tracked in original (280px-scale) coordinates.
  // Display values are multiplied by `scale`.
  const displayOffset = Math.round(offset * scale);

  const verify = useCallback(async () => {
    if (!enabled || !challenge || verifying || verified) {
      return;
    }

    const finalX = clampSliderX(offset, challenge.width, challenge.piece_size);
    const track = dragRef.current.track.length ? dragRef.current.track : [toTrackPoint(finalX, 0)];

    setVerifying(true);
    setError('');
    try {
      const data = await verifyCaptchaApi({
        challenge_id: challenge.challenge_id,
        x: finalX,
        track,
      });
      if (!mountedRef.current) return;
      setVerified(true);
      onVerified(data.captcha_token);
    } catch {
      if (!mountedRef.current) return;
      setError('滑块位置不正确，请重新验证');
      await loadChallenge();
    } finally {
      if (mountedRef.current) {
        setVerifying(false);
      }
    }
  }, [challenge, enabled, loadChallenge, offset, onVerified, verified, verifying]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled || !challenge || verified || verifying) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      dragging: true,
      startClientX: event.clientX,
      startOffset: offset,
      startTime: performance.now(),
      track: [toTrackPoint(offset, 0)],
    };
    setError('');
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!challenge || !dragRef.current.dragging) {
      return;
    }
    const delta = event.clientX - dragRef.current.startClientX;
    // Convert screen-pixel delta back to original 280px coordinate space
    const originalDelta = Math.round(delta / scale);
    const nextOffset = clampSliderX(dragRef.current.startOffset + originalDelta, challenge.width, challenge.piece_size);
    setOffset(nextOffset);
    dragRef.current.track.push(toTrackPoint(nextOffset, performance.now() - dragRef.current.startTime));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.dragging) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current.dragging = false;
    void verify();
  };

  return (
    <div
      className={`slider-captcha${verified ? ' slider-captcha-verified' : ''}${!enabled ? ' slider-captcha-disabled' : ''}`}
      data-captcha-target-x={challenge?.target_x ?? ''}
      data-testid="slider-captcha"
    >
      <div className="slider-captcha-header">
        <Typography.Text strong>安全验证</Typography.Text>
        <Button
          aria-label="刷新验证图片"
          disabled={!enabled}
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void loadChallenge()}
          type="text"
        />
      </div>

      {enabled ? (
        <Spin spinning={loading || verifying}>
          <div className="slider-captcha-stage" ref={stageRef} style={{ height: stageHeight }}>
            {challenge ? (
              <>
                <img alt="" className="slider-captcha-bg" draggable={false} src={challenge.background} />
                <img
                  alt=""
                  className="slider-captcha-piece"
                  draggable={false}
                  src={challenge.piece}
                  style={{
                    left: displayOffset,
                    top: Math.round(challenge.target_y * scale),
                    width: pieceDisplaySize,
                    height: pieceDisplaySize,
                  }}
                />
              </>
            ) : null}
          </div>

          <div className="slider-captcha-track">
            <div className="slider-captcha-progress" style={{ width: challenge ? sliderProgressWidth(displayOffset, pieceDisplaySize) : 0 }} />
            <button
              aria-label="拖动滑块"
              className="slider-captcha-handle"
              disabled={!challenge || verified || verifying}
              onPointerCancel={handlePointerUp}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ transform: `translateX(${displayOffset}px)` }}
              type="button"
            >
              <SwapRightOutlined />
            </button>
            <span className="slider-captcha-track-text">{verified ? '验证通过' : '向右拖动滑块'}</span>
          </div>
        </Spin>
      ) : null}

      {(error || verified || enabled) && (
        <div className="slider-captcha-status" role="status">
          {error || (verified ? '可以登录' : '请将拼图块拖到缺口位置')}
        </div>
      )}
    </div>
  );
}
