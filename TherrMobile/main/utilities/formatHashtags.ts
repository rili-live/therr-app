export default (value, hashtagsClone) => {
    const lastCharacter = value.substring(value.length - 1, value.length);
    let modifiedValue = value.replace(/[^\w_]/gi, '');

    if (lastCharacter === ',' || lastCharacter === ' ') {
        const tag = modifiedValue.substring(0, modifiedValue.length - 1);
        if (tag !== '' && hashtagsClone.length < 50 && !hashtagsClone.includes(tag)) {
            hashtagsClone.push(modifiedValue.substring(0, modifiedValue.length - 1));
        }
        modifiedValue = '';
    }

    return {
        formattedValue: modifiedValue,
        formattedHashtags: hashtagsClone,
    };
};
