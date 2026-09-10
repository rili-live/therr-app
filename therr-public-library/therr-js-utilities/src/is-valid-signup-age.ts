// Minimum age required to create an account. 13 is the COPPA floor (US);
// content for users under 18 is further restricted via `shouldHideMatureContent`.
// Centralized here so the API gateway, users-service, web, and mobile all agree.
export const MINIMUM_SIGNUP_AGE = 13;

/**
 * Returns the integer age (in whole years) for a given birthdate as of now.
 * Returns NaN when the input is not a parseable date.
 */
export const getAgeFromBirthdate = (birthdate: string | number | Date): number => {
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) {
        return NaN;
    }

    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDelta = now.getMonth() - birth.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
        age -= 1;
    }

    return age;
};

/**
 * Validates that a birthdate represents a real, past date and that the
 * resulting age meets the minimum signup age.
 */
export default (birthdate: string | number | Date, minimumAge: number = MINIMUM_SIGNUP_AGE): boolean => {
    const age = getAgeFromBirthdate(birthdate);
    if (Number.isNaN(age)) {
        return false;
    }

    // Reject future birthdates and absurdly large ages (likely bad input).
    return age >= minimumAge && age < 120;
};
