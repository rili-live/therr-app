const sanitizeUserName = (userName: string) => {
    if (!userName) {
        return '';
    }

    return userName.replace(/[^\w.]/g, '').replace(/\.\./, '.').replace(/__/, '.').toLocaleLowerCase();
};

export {
    sanitizeUserName,
};
