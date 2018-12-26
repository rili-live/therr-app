/**
 * easeInOutQuad
 * @param time -
 * @param startValue -
 * @param valueChange -
 * @param duration -
 */
const easeInOutQuad = (time: number, startValue: number, valueChange: number, duration: number) => {
    let currentTime = time / (duration / 2);
    if (currentTime < 1) {
        return valueChange / 2 * currentTime * currentTime + startValue; // eslint-disable-line no-mixed-operators
    }
    currentTime -= 1;
    return -valueChange / 2 * (currentTime * (currentTime - 2) - 1) + startValue; // eslint-disable-line no-mixed-operators
};

/**
 * scrollTo
 * @param to - pixels from top to scroll to
 * @param duration - amount of time spent scrolling
 */
const scrollTo = (to: number, duration: number) => {
    let currentTime = 0;
    const increment = 20;
    const start = window.pageYOffset || document.documentElement.scrollTop;
    const change = to - start;

    const animateScroll = () => {
        currentTime += increment;
        const val = easeInOutQuad(currentTime, start, change, duration);
        document.body.scrollTop = val;
        document.documentElement.scrollTop = val;
        if (currentTime < duration) {
            setTimeout(animateScroll, increment);
        }
    };
    animateScroll();
};

export default scrollTo;
