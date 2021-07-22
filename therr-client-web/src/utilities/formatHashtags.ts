export default (value, hashtagsClone) => {
    let modifiedValue = value.replace(/[^\w_,\s]/gi, '');

    const lastCharacter = modifiedValue.substring(modifiedValue.length - 1, modifiedValue.length);
    if (lastCharacter === ',' || lastCharacter === ' ') {
        const tag = modifiedValue.substring(0, modifiedValue.length - 1);
        if (hashtagsClone.length < 100 && !hashtagsClone.includes(tag)) {
            hashtagsClone.push(modifiedValue.substring(0, modifiedValue.length - 1));
        }
        modifiedValue = '';
    }

    return {
        formattedValue: modifiedValue,
        formattedHashtags: hashtagsClone,
    };
};
