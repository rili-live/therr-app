const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type IVariation = 'default' | 'short';

export default (
    unformattedDate,
    variation: IVariation = 'default',
): {
    date: string;
    time: string;
} => {
    if (!unformattedDate) {
        return {
            date: '',
            time: '',
        };
    }
    const date = new Date(unformattedDate);
    const year = date.getFullYear();
    const month = MONTHS[date.getMonth()];
    const day = date.getDate();

    let hours = date.getHours();
    hours = hours >= 12 ? hours - 11 : hours;
    const amPm = hours >= 12 ? 'PM' : 'AM';
    const minute = date.getMinutes().toString();

    if (variation === 'short') {
        return {
            date: `${date.getMonth() + 1}/${day}/${year.toString().substring(2, 4)}`,
            time: `${hours}:${minute.padStart(2, '0')} ${amPm}`,
        };
    }

    return {
        date: `${month} ${day}, ${year}`,
        time: `${hours}:${minute.padStart(2, '0')} ${amPm}`,
    };
};
