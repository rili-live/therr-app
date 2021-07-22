export default (value, hashtagsClone) => {
    const lastCharacter = value.substring(value.length - 1, value.length);
    let modifiedValue = value.replace(/[^\w_]/gi, '');

    if (lastCharacter === ',' || lastCharacter === ' ') {
        const tag = modifiedValue;
        if (tag !== '' && hashtagsClone.length < 50 && !hashtagsClone.includes(tag)) {
            hashtagsClone.push(tag);
        }
        modifiedValue = '';
    }

    return {
        formattedValue: modifiedValue,
        formattedHashtags: hashtagsClone,
    };
};
