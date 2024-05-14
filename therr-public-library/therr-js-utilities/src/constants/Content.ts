const mediaTypes = {
    USER_IMAGE_PUBLIC: 'user-image-public',
    USER_IMAGE_PRIVATE: 'user-image-private',
};

const interestsMap = {
    // Edit Thought
    'forms.editThought.categories.art': 'interests.arts.painting',
    'forms.editThought.categories.music': 'interests.arts.instruments',
    'forms.editThought.categories.deals': 'interests.business.localBusiness',
    'forms.editThought.categories.geocache': 'interests.games.boardGames',
    'forms.editThought.categories.event/space': 'interests.business.localBusiness',
    'forms.editThought.categories.storefront': 'interests.business.localBusiness',
    'forms.editThought.categories.travel': 'interests.business.businessTravel',
    'forms.editThought.categories.fitness': 'interests.sports.gymWorkouts',
    'forms.editThought.categories.food': 'interests.foodDrink.dining',
    'forms.editThought.categories.menu': 'interests.foodDrink.dining',
    'forms.editThought.categories.nightLife': 'interests.foodDrink.happyHour',
    'forms.editThought.categories.drinks': 'interests.foodDrink.cocktails',
    'forms.editThought.categories.nature': 'interests.sports.running',

    // Edit Moment
    'forms.editMoment.categories.music': 'interests.arts.instruments',
    'forms.editMoment.categories.food': 'interests.foodDrink.dining',
    'forms.editMoment.categories.drinks': 'interests.foodDrink.cocktails',
    'forms.editMoment.categories.art': 'interests.arts.painting',
    'forms.editMoment.categories.nature': 'interests.sports.running',
    'forms.editMoment.categories.travel': 'interests.business.businessTravel',
    'forms.editMoment.categories.fitness': 'interests.sports.gymWorkouts',
    'forms.editMoment.categories.nightLife': 'interests.foodDrink.happyHour',
    'forms.editMoment.categories.geocache': 'interests.games.boardGames',

    // Edit Space
    'forms.editMoment.categories.storefront/shop': 'interests.business.localBusiness',
    'forms.editMoment.categories.restaurant/food': 'interests.foodDrink.dining',
    'forms.editMoment.categories.marketplace/festival': 'interests.arts.visualArts',
    'forms.editMoment.categories.artwork/expression': 'interests.arts.visualArts',
    'forms.editMoment.categories.music/concerts': 'interests.arts.instruments',
    'forms.editMoment.categories.bar/drinks': 'interests.foodDrink.cocktails',
    'forms.editMoment.categories.nature/parks': 'interests.sports.running',
    'forms.editMoment.categories.hotels/lodging': 'interests.business.businessTravel',
    'forms.editMoment.categories.event/space': 'interests.business.localBusiness',

    // Edit Event
    'forms.editEvent.categories.art': 'interests.arts.painting',
    'forms.editEvent.categories.music': 'interests.arts.instruments',
    'forms.editEvent.categories.deals': 'interests.business.localBusiness',
    'forms.editEvent.categories.geocache': 'interests.games.boardGames',
    'forms.editEvent.categories.gaming': 'interests.games.videoGamesConsole',
    'forms.editEvent.categories.event/space': 'interests.business.localBusiness',
    'forms.editEvent.categories.storefront': 'interests.business.localBusiness',
    'forms.editEvent.categories.travel': 'interests.business.businessTravel',
    'forms.editEvent.categories.fitness': 'interests.sports.gymWorkouts',
    'forms.editEvent.categories.food': 'interestsCategories.foodDrink',
    'forms.editEvent.categories.menu': 'interestsCategories.foodDrink',
    'forms.editEvent.categories.nightLife': 'interestsCategories.foodDrink',
    'forms.editEvent.categories.drinks': 'interestsCategories.foodDrink',
    'forms.editEvent.categories.nature': 'interestsCategories.sports',
    'forms.editEvent.categories.seasonal': 'interestsCategories.sports',
};

export default {
    interestsMap,
    mediaTypes,
};
