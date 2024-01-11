// eslint-disable-next-line arrow-body-style
export default (password: string) => {
    return /[0-9]/i.test(password)
        && /[a-z]/i.test(password)
        && /[A-Z]/.test(password)
        && /[!@#$%^&*]/.test(password)
        && password?.length >= 8;
};
