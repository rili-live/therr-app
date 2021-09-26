const isMyMoment = (selectedMoment, user) => {
    return String(selectedMoment.fromUserId) === String(user.details.id);
};

export {
    isMyMoment,
};
