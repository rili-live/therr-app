/**
 * The Friends with Habits chameleon, as drawn in `assets/habits-logo.svg`.
 *
 * One copy of the geometry, shared by everything that draws the mascot in-app
 * (the loader, the achievement badges), so that the icon on the phone and the
 * chameleon on every screen are literally the same drawing. Coordinates are in
 * the logo's 1024-unit canvas; `FACE_VIEW_BOX` crops that canvas to the face.
 */

export const FACE_VIEW_BOX = '150 200 724 580';
/** height / width of the cropped face. */
export const FACE_ASPECT = 580 / 724;

export const HEAD_PATH = 'M 437 335 Q 512 205 587 335 Q 722 482 757 629 Q 832 759 682 759 Q 512 779 342 759 Q 192 759 267 629 Q 302 482 437 335 Z';
export const STRIPE_PATH = 'M 494 325 Q 494 305 512 305 Q 530 305 530 325 L 525 477 Q 525 493 512 493 Q 499 493 499 477 Z';
export const SMILE_PATH = 'M 418 718 Q 512 762 606 718';
export const SMILE_STROKE_WIDTH = 12;

export const EYE_SOCKET_RADIUS = 148;
export const EYE_WHITE_RADIUS = 95;
export const PUPIL_RADIUS = 44;
export const HIGHLIGHT_RADIUS = 15;
/** The pupil highlight sits up and to the right of the pupil in the logo. */
export const HIGHLIGHT_OFFSET = { dx: 14, dy: -13 };

export const LEFT_EYE = { cx: 260, cy: 510 };
export const RIGHT_EYE = { cx: 764, cy: 510 };
/** Pupils rest slightly inward of the eye centres, which is what gives the logo its focus. */
export const LEFT_PUPIL = { cx: 280, cy: 517 };
export const RIGHT_PUPIL = { cx: 744, cy: 517 };

export const NOSTRILS = [{ cx: 488, cy: 653 }, { cx: 536, cy: 653 }];
export const NOSTRIL_RADIUS = 11;
export const NOSTRIL_OPACITY = 0.62;
