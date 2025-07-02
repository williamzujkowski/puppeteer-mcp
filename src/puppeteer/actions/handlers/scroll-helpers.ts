/**
 * Scroll helper utilities
 * @module puppeteer/actions/handlers/scroll-helpers
 */

/**
 * Calculate scroll values based on direction and distance
 * @param direction - Scroll direction
 * @param distance - Distance to scroll
 * @returns Object with scrollX and scrollY values
 */
export function calculateScrollValues(direction: string, distance: number): { scrollX: number; scrollY: number } {
  let scrollX = 0;
  let scrollY = 0;

  switch (direction) {
    case 'up':
      scrollY = -distance;
      break;
    case 'down':
      scrollY = distance;
      break;
    case 'left':
      scrollX = -distance;
      break;
    case 'right':
      scrollX = distance;
      break;
    default:
      throw new Error(`Invalid scroll direction: ${direction}`);
  }

  return { scrollX, scrollY };
}

/**
 * Calculate target position based on start position and direction
 * @param startX - Starting X position
 * @param startY - Starting Y position
 * @param direction - Scroll direction
 * @param distance - Distance to scroll
 * @returns Target position
 */
export function calculateTargetPosition(
  startX: number,
  startY: number,
  direction: string,
  distance: number
): { targetX: number; targetY: number } {
  let targetX = startX;
  let targetY = startY;

  switch (direction) {
    case 'up':
      targetY = Math.max(0, startY - distance);
      break;
    case 'down':
      targetY = startY + distance;
      break;
    case 'left':
      targetX = Math.max(0, startX - distance);
      break;
    case 'right':
      targetX = startX + distance;
      break;
  }

  return { targetX, targetY };
}

/**
 * Validate scroll parameters
 * @param distance - Scroll distance
 * @param duration - Animation duration (optional)
 */
export function validateScrollParams(distance: number, duration?: number): void {
  if (distance < 1 || distance > 10000) {
    throw new Error('Scroll distance must be between 1 and 10000 pixels');
  }
  
  if (duration !== undefined && (duration < 100 || duration > 5000)) {
    throw new Error('Duration must be between 100 and 5000 milliseconds');
  }
}