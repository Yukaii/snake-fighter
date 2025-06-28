import React, { useState, useRef, useCallback, useEffect } from 'react'

const MobileController = ({
  onDirectionChange,
  onObstaclePlace,
  controlType = 'arrows',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentDirection, setCurrentDirection] = useState(null)
  const joystickRef = useRef(null)
  const knobRef = useRef(null)

  const handleArrowPress = useCallback(
    (direction) => {
      if (disabled) return

      let directionVector = null
      switch (direction) {
        case 'up':
          directionVector = { x: 0, y: -1 }
          break
        case 'down':
          directionVector = { x: 0, y: 1 }
          break
        case 'left':
          directionVector = { x: -1, y: 0 }
          break
        case 'right':
          directionVector = { x: 1, y: 0 }
          break
      }

      if (directionVector && onDirectionChange) {
        onDirectionChange(directionVector)
      }
    },
    [onDirectionChange, disabled]
  )

  const handleJoystickStart = useCallback(
    (e) => {
      if (disabled) return

      e.preventDefault()
      setIsDragging(true)

      const rect = joystickRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      setStartPos({ x: centerX, y: centerY })
    },
    [disabled]
  )

  const calculateDirection = useCallback((deltaX, deltaY) => {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left'
    }
    return deltaY > 0 ? 'down' : 'up'
  }, [])

  const updateKnobPosition = useCallback((deltaX, deltaY, distance) => {
    if (!knobRef.current) return

    const maxDistance = 40
    const clampedDistance = Math.min(distance, maxDistance)
    const angle = Math.atan2(deltaY, deltaX)
    const knobX = Math.cos(angle) * clampedDistance
    const knobY = Math.sin(angle) * clampedDistance

    knobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`
  }, [])

  const processDirectionChange = useCallback(
    (deltaX, deltaY, distance) => {
      const deadZone = 10
      if (distance <= deadZone) return

      const newDirection = calculateDirection(deltaX, deltaY)
      if (newDirection !== currentDirection) {
        setCurrentDirection(newDirection)
        handleArrowPress(newDirection)
      }
    },
    [calculateDirection, currentDirection, handleArrowPress]
  )

  const handleJoystickMove = useCallback(
    (e) => {
      if (!isDragging || disabled) return

      e.preventDefault()

      const touch = e.touches ? e.touches[0] : e
      const deltaX = touch.clientX - startPos.x
      const deltaY = touch.clientY - startPos.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      processDirectionChange(deltaX, deltaY, distance)
      updateKnobPosition(deltaX, deltaY, distance)
    },
    [isDragging, startPos, disabled, processDirectionChange, updateKnobPosition]
  )

  const handleJoystickEnd = useCallback(() => {
    setIsDragging(false)
    setCurrentDirection(null)

    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0, 0)'
    }
  }, [])

  const handleObstacleTouch = useCallback(() => {
    if (disabled) return

    if (onObstaclePlace) {
      onObstaclePlace()
    }
  }, [onObstaclePlace, disabled])

  // Add touch event listeners for joystick
  useEffect(() => {
    const handleTouchMove = (e) => handleJoystickMove(e)
    const handleTouchEnd = () => handleJoystickEnd()

    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      document.addEventListener('mousemove', handleTouchMove)
      document.addEventListener('mouseup', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('mousemove', handleTouchMove)
      document.removeEventListener('mouseup', handleTouchEnd)
    }
  }, [isDragging, handleJoystickMove, handleJoystickEnd])

  const ArrowControls = () => (
    <div className="mobile-controller-arrows">
      <div className="arrow-grid">
        <div />
        <button
          type="button"
          className="arrow-btn up"
          onTouchStart={() => handleArrowPress('up')}
          onMouseDown={() => handleArrowPress('up')}
          disabled={disabled}
        >
          ↑
        </button>
        <div />
        <button
          type="button"
          className="arrow-btn left"
          onTouchStart={() => handleArrowPress('left')}
          onMouseDown={() => handleArrowPress('left')}
          disabled={disabled}
        >
          ←
        </button>
        <div />
        <button
          type="button"
          className="arrow-btn right"
          onTouchStart={() => handleArrowPress('right')}
          onMouseDown={() => handleArrowPress('right')}
          disabled={disabled}
        >
          →
        </button>
        <div />
        <button
          type="button"
          className="arrow-btn down"
          onTouchStart={() => handleArrowPress('down')}
          onMouseDown={() => handleArrowPress('down')}
          disabled={disabled}
        >
          ↓
        </button>
        <div />
      </div>
    </div>
  )

  const JoystickControls = () => (
    <div className="mobile-controller-joystick">
      <div
        ref={joystickRef}
        className="joystick-container"
        onTouchStart={handleJoystickStart}
        onMouseDown={handleJoystickStart}
      >
        <div ref={knobRef} className="joystick-knob" />
      </div>
    </div>
  )

  return (
    <>
      <style>
        {`
          .mobile-controller {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 40px;
            background: rgba(0, 0, 0, 0.5);
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            z-index: 1000;
            user-select: none;
            touch-action: none;
          }

          .mobile-controller.disabled {
            opacity: 0.3;
            pointer-events: none;
          }

          .mobile-controller-arrows .arrow-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            gap: 5px;
            width: 150px;
            height: 150px;
          }

          .arrow-btn {
            background: rgba(255, 255, 255, 0.8);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            color: #333;
            font-size: 24px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.1s;
            touch-action: manipulation;
          }

          .arrow-btn:active {
            background: rgba(255, 255, 255, 1);
            transform: scale(0.95);
          }

          .arrow-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .mobile-controller-joystick .joystick-container {
            width: 120px;
            height: 120px;
            background: rgba(255, 255, 255, 0.2);
            border: 3px solid rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            position: relative;
            cursor: pointer;
            touch-action: none;
          }

          .joystick-knob {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.8);
            border: 2px solid rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: all 0.1s;
            pointer-events: none;
          }

          .obstacle-btn {
            background: rgba(255, 165, 0, 0.8);
            border: 2px solid rgba(255, 165, 0, 0.6);
            border-radius: 50%;
            color: white;
            font-size: 18px;
            font-weight: bold;
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.1s;
            touch-action: manipulation;
          }

          .obstacle-btn:active {
            background: rgba(255, 165, 0, 1);
            transform: scale(0.95);
          }

          .obstacle-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @media (max-width: 768px) {
            .mobile-controller {
              bottom: 10px;
              padding: 15px;
              gap: 30px;
            }

            .mobile-controller-arrows .arrow-grid {
              width: 120px;
              height: 120px;
            }

            .arrow-btn {
              font-size: 20px;
            }

            .mobile-controller-joystick .joystick-container {
              width: 100px;
              height: 100px;
            }

            .joystick-knob {
              width: 35px;
              height: 35px;
            }

            .obstacle-btn {
              width: 70px;
              height: 70px;
              font-size: 16px;
            }
          }
        `}
      </style>
      <div className={`mobile-controller ${disabled ? 'disabled' : ''}`}>
        {controlType === 'arrows' ? <ArrowControls /> : <JoystickControls />}

        <button
          type="button"
          className="obstacle-btn"
          onTouchStart={handleObstacleTouch}
          onMouseDown={handleObstacleTouch}
          disabled={disabled}
        >
          🚧
        </button>
      </div>
    </>
  )
}

export default MobileController
