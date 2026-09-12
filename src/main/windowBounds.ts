export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export const clampWindowPosition = (
  proposedX: number,
  proposedY: number,
  windowWidth: number,
  windowHeight: number,
  workArea: Rectangle
): WindowPosition => {
  const maximumX = workArea.x + Math.max(workArea.width - windowWidth, 0);
  const maximumY = workArea.y + Math.max(workArea.height - windowHeight, 0);

  return {
    x: Math.round(Math.min(Math.max(proposedX, workArea.x), maximumX)),
    y: Math.round(Math.min(Math.max(proposedY, workArea.y), maximumY))
  };
};

export const positionWindowOnFloor = (
  workArea: Rectangle,
  windowWidth: number,
  windowHeight: number,
  horizontalMargin = 0
): WindowPosition => {
  return clampWindowPosition(
    workArea.x + workArea.width - windowWidth - horizontalMargin,
    workArea.y + workArea.height - windowHeight,
    windowWidth,
    windowHeight,
    workArea
  );
};
