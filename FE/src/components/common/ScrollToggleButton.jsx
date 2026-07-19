import { useState, useEffect, useCallback } from 'react';
import './ScrollToggleButton.css';

/**
 * ArrowUp icon (inline SVG)
 */
function ArrowUpIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

/**
 * ArrowDown icon (inline SVG)
 */
function ArrowDownIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

/**
 * ScrollToggleButton
 *
 * Floating button that appears when page is scrollable.
 * Shows ↑ when near bottom, ↓ when near top.
 * Click scrolls to opposite end smoothly.
 */
export default function ScrollToggleButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [isNearTop, setIsNearTop] = useState(true);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const scrollable = scrollHeight - clientHeight > 50;

    setIsVisible(scrollable);

    if (scrollable) {
      const distanceToTop = scrollTop;
      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      // Show down-arrow when closer to top than bottom
      setIsNearTop(distanceToTop <= distanceToBottom);
    }
  }, []);

  useEffect(() => {
    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleClick = () => {
    window.scrollTo({
      top: isNearTop ? document.documentElement.scrollHeight : 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      className={`scroll-toggle-btn ${isVisible ? 'scroll-toggle-btn--visible' : ''}`}
      onClick={handleClick}
      aria-label={isNearTop ? 'Cuộn xuống cuối trang' : 'Cuộn lên đầu trang'}
      title={isNearTop ? 'Cuộn xuống cuối trang' : 'Cuộn lên đầu trang'}
    >
      {isNearTop ? <ArrowDownIcon /> : <ArrowUpIcon />}
    </button>
  );
}
