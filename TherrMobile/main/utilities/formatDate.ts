const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type IVariation = 'default' | 'short';

const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365;
const millisecondsPerDay = 1000 * 60 * 60 * 24;
const millisecondsPerHour = 1000 * 60 * 60;

export const hoursDaysOrYearsSince = (pastDate: Date, translate: (key: string, params?: any ) => string) => {
    const today = new Date();

    // Calculate the difference in milliseconds
    const differenceInMilliseconds = today.getTime() - pastDate.getTime();

    // Convert milliseconds to days
    const daysSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerDay);
    if (daysSinceDate < 1) {
        const hoursSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerHour);
        if (hoursSinceDate < 1) {
            return  translate('dateTime.lessThanHours');
        }
        return  translate('dateTime.hoursSinceDate', {
            count: hoursSinceDate,
        });
    } else if (daysSinceDate >= 365) {
        const yearsSinceDate = Math.floor(differenceInMilliseconds / millisecondsPerYear);
        return  translate('dateTime.yearsSinceDate', {
            count: yearsSinceDate,
        });
    }

    return translate('dateTime.daysSinceDate', {
        count: daysSinceDate,
    });
};

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
    const amPm = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) {
        hours = 12;
    }
    hours = hours > 12 ? hours - 12 : hours;
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
