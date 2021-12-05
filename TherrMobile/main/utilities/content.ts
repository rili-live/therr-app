const isMyArea = (selectedMoment, user) => {
    return String(selectedMoment.fromUserId) === String(user.details.id);
};

export {
    isMyArea,
};
