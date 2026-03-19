import { UsersService } from 'therr-react/services';

let isNavigating = false;

const handleMentionPress = (
    username: string,
    goToViewUser: (userId: string) => void,
) => {
    if (isNavigating) {
        return;
    }

    isNavigating = true;

    UsersService.getByUserName(username)
        .then((response) => {
            const user = response?.data;
            if (user?.id) {
                goToViewUser(user.id);
            }
        })
        .catch(() => {
            // User not found or network error - silently ignore
        })
        .finally(() => {
            setTimeout(() => {
                isNavigating = false;
            }, 500);
        });
};

export default handleMentionPress;
