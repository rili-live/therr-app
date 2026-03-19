import { UsersService } from 'therr-react/services';

const handleMentionPress = (
    username: string,
    goToViewUser: (userId: string) => void,
) => {
    UsersService.getByUserName(username)
        .then((response) => {
            const user = response?.data;
            if (user?.id) {
                goToViewUser(user.id);
            }
        })
        .catch(() => {
            // User not found or network error - silently ignore
        });
};

export default handleMentionPress;
