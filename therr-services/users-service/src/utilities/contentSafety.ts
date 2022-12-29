import BadWordsFilter from 'bad-words';

const badWordFilter = new BadWordsFilter();
badWordFilter.addWords('sexting');

// eslint-disable-next-line arrow-body-style
const isTextUnsafe = (texts: string[]) => {
    return texts.some((text: string) => badWordFilter.isProfane(text));
};

export {
    isTextUnsafe,
};
